import { createFileRoute } from "@tanstack/react-router";
import { EditorPage, editorSearchSchema } from "@/pages/editor-page";

export const Route = createFileRoute("/app/vsl/editor")({
  validateSearch: editorSearchSchema,
  head: () => ({
    meta: [{ title: "Editor VSL · Andromeda" }],
  }),
  component: VslEditorRoute,
});

function VslEditorRoute() {
  const search = Route.useSearch();
  return <EditorPage mode="vsl" search={search} />;
}
