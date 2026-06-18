#!/usr/bin/env node
/**
 * Microserviço FFmpeg para render de criativos Andromeda.
 * Env: FFMPEG_SERVICE_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT
 */
import http from "node:http";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";

const PORT = process.env.PORT ?? 3456;
const SECRET = process.env.FFMPEG_SERVICE_SECRET ?? "dev-secret";
const BUCKET = "criativos-media";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function escapeAss(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}

function blockDurationSec(tempo, index, total) {
  const m = String(tempo ?? "").match(/(\d+)/);
  if (m) return Math.max(2, Math.min(8, parseInt(m[1], 10)));
  return total <= 3 ? 5 : 4;
}

function buildAssSubtitles(roteiro, totalDuration) {
  let cursor = 0;
  const events = [];
  for (let i = 0; i < roteiro.length; i++) {
    const b = roteiro[i];
    const dur = blockDurationSec(b.tempo, i, roteiro.length);
    const start = formatAssTime(cursor);
    const end = formatAssTime(Math.min(cursor + dur, totalDuration));
    const text = escapeAss(b.conteudo ?? "");
    events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
    cursor += dur;
  }
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,5,40,40,280,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

function formatAssTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

async function downloadFromStorage(supabase, storagePath, dest) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`Download ${storagePath}: ${error.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function uploadToStorage(supabase, storagePath, filePath, contentType) {
  const body = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload ${storagePath}: ${error.message}`);
  return storagePath;
}

function renderVideo({ workDir, criativoId, roteiro, assPath, bgPath, audioPath, width, height, suffix }) {
  const outFile = path.join(workDir, `${criativoId}-${suffix}.mp4`);
  const totalDuration = roteiro.reduce(
    (acc, b, i) => acc + blockDurationSec(b.tempo, i, roteiro.length),
    0,
  );
  const dur = Math.max(totalDuration, 5);

  const assEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  let vf = `subtitles='${assEscaped}',scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

  let inputArgs;
  if (bgPath && fs.existsSync(bgPath)) {
    inputArgs = `-loop 1 -i "${bgPath}"`;
  } else {
    inputArgs = `-f lavfi -i color=c=0x1a1a2e:s=${width}x${height}:d=${dur}`;
  }

  let audioArgs = "";
  if (audioPath && fs.existsSync(audioPath)) {
    audioArgs = `-i "${audioPath}" -shortest`;
  }

  const cmd = `ffmpeg -y ${inputArgs} ${audioArgs} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -t ${dur} "${outFile}"`;
  try {
    execSync(cmd, { stdio: "ignore", timeout: 120000 });
  } catch {
    execSync(
      `ffmpeg -y -f lavfi -i color=c=black:s=${width}x${height}:d=${dur} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p "${outFile}"`,
      { stdio: "ignore", timeout: 60000 },
    );
  }
  return outFile;
}

function concatAudio(workDir, audioPaths) {
  const listFile = path.join(workDir, "audios.txt");
  const lines = audioPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`);
  fs.writeFileSync(listFile, lines.join("\n"));
  const out = path.join(workDir, "narration.mp3");
  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${out}"`, {
      stdio: "ignore",
      timeout: 60000,
    });
    return out;
  } catch {
    return null;
  }
}

async function processRender(payload) {
  const { criativoId, roteiro = [], audioPaths = {}, backgroundMediaPath, utmContent } = payload;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "andromeda-"));
  const blocks = Array.isArray(roteiro) ? roteiro : [];
  const totalDuration = blocks.reduce(
    (acc, b, i) => acc + blockDurationSec(b.tempo, i, blocks.length),
    0,
  );

  const assPath = path.join(workDir, "subs.ass");
  fs.writeFileSync(assPath, buildAssSubtitles(blocks, Math.max(totalDuration, 5)));

  let bgPath = null;
  if (backgroundMediaPath) {
    bgPath = path.join(workDir, "bg" + path.extname(backgroundMediaPath));
    try {
      await downloadFromStorage(supabase, backgroundMediaPath, bgPath);
    } catch {
      bgPath = null;
    }
  }

  const audioMap = typeof audioPaths === "object" && audioPaths ? audioPaths : {};
  const sortedKeys = Object.keys(audioMap).sort((a, b) => Number(a) - Number(b));
  const localAudios = [];
  for (const key of sortedKeys) {
    const storagePath = audioMap[key];
    if (!storagePath) continue;
    const dest = path.join(workDir, `audio-${key}.mp3`);
    try {
      await downloadFromStorage(supabase, storagePath, dest);
      localAudios.push(dest);
    } catch {
      /* skip missing audio */
    }
  }
  const mergedAudio = localAudios.length > 0 ? concatAudio(workDir, localAudios) : null;

  const formats = [
    { suffix: "9x16", width: 1080, height: 1920 },
    { suffix: "4x5", width: 1080, height: 1350 },
  ];

  const storagePaths = [];
  for (const fmt of formats) {
    const localFile = renderVideo({
      workDir,
      criativoId,
      roteiro: blocks,
      assPath,
      bgPath,
      audioPath: mergedAudio,
      width: fmt.width,
      height: fmt.height,
      suffix: fmt.suffix,
    });
    const storagePath = `exports/${criativoId}/${criativoId}-${fmt.suffix}.mp4`;
    await uploadToStorage(supabase, storagePath, localFile, "video/mp4");
    storagePaths.push(storagePath);
  }

  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return { paths: storagePaths, utm: utmContent ?? criativoId };
}

async function processRenderClipes(payload) {
  const { criativoId, roteiro = [], audioPaths = {}, clipPaths = [], utmContent } = payload;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "andromeda-clips-"));
  const blocks = Array.isArray(roteiro) ? roteiro : [];
  const clips = Array.isArray(clipPaths) ? clipPaths : [];

  const totalDuration = blocks.reduce(
    (acc, b, i) => acc + blockDurationSec(b.tempo, i, blocks.length),
    0,
  );

  const assPath = path.join(workDir, "subs.ass");
  fs.writeFileSync(assPath, buildAssSubtitles(blocks, Math.max(totalDuration, 5)));

  const localClips = [];
  for (let i = 0; i < clips.length; i++) {
    const storagePath = clips[i];
    if (!storagePath) continue;
    const dest = path.join(workDir, `clip-${i}.mp4`);
    try {
      await downloadFromStorage(supabase, storagePath, dest);
      const dur = blockDurationSec(blocks[i]?.tempo, i, blocks.length);
      const scaled = path.join(workDir, `clip-${i}-scaled.mp4`);
      execSync(
        `ffmpeg -y -i "${dest}" -t ${dur} -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -an "${scaled}"`,
        { stdio: "ignore", timeout: 120000 },
      );
      localClips.push(scaled);
    } catch {
      /* skip */
    }
  }

  if (localClips.length === 0) {
    throw new Error("Nenhum clipe válido para montagem");
  }

  const concatList = path.join(workDir, "clips.txt");
  fs.writeFileSync(
    concatList,
    localClips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
  );
  const mergedVideo = path.join(workDir, "merged.mp4");
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${mergedVideo}"`, {
    stdio: "ignore",
    timeout: 120000,
  });

  const audioMap = typeof audioPaths === "object" && audioPaths ? audioPaths : {};
  const sortedKeys = Object.keys(audioMap).sort((a, b) => Number(a) - Number(b));
  const localAudios = [];
  for (const key of sortedKeys) {
    const storagePath = audioMap[key];
    if (!storagePath) continue;
    const dest = path.join(workDir, `audio-${key}.mp3`);
    try {
      await downloadFromStorage(supabase, storagePath, dest);
      localAudios.push(dest);
    } catch {
      /* skip */
    }
  }
  const mergedAudio = localAudios.length > 0 ? concatAudio(workDir, localAudios) : null;

  const formats = [
    { suffix: "9x16", width: 1080, height: 1920 },
    { suffix: "4x5", width: 1080, height: 1350 },
  ];

  const assEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  const storagePaths = [];

  for (const fmt of formats) {
    const outFile = path.join(workDir, `${criativoId}-${fmt.suffix}.mp4`);
    const vf = `subtitles='${assEscaped}',scale=${fmt.width}:${fmt.height}:force_original_aspect_ratio=decrease,pad=${fmt.width}:${fmt.height}:(ow-iw)/2:(oh-ih)/2`;
    const audioArg = mergedAudio ? `-i "${mergedAudio}" -shortest` : "";
    const cmd = `ffmpeg -y -i "${mergedVideo}" ${audioArg} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -c:a aac "${outFile}"`;
    try {
      execSync(cmd, { stdio: "ignore", timeout: 180000 });
    } catch {
      execSync(
        `ffmpeg -y -i "${mergedVideo}" -vf "${vf}" -c:v libx264 -pix_fmt yuv420p "${outFile}"`,
        { stdio: "ignore", timeout: 120000 },
      );
    }
    const storagePath = `exports/${criativoId}/${criativoId}-${fmt.suffix}.mp4`;
    await uploadToStorage(supabase, storagePath, outFile, "video/mp4");
    storagePaths.push(storagePath);
  }

  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return { paths: storagePaths, utm: utmContent ?? criativoId };
}

const server = http.createServer(async (req, res) => {
  const route = req.url?.split("?")[0];

  if (req.method === "GET" && route === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, endpoints: ["/render", "/render-clipes"] }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const route = req.url?.split("?")[0];
  if (route !== "/render" && route !== "/render-clipes") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (auth !== SECRET) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const payload = JSON.parse(body);
    const result =
      route === "/render-clipes"
        ? await processRenderClipes(payload)
        : await processRender(payload);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => {
  console.log(`FFmpeg render service on :${PORT}`);
});
