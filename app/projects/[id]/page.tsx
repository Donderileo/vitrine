import ProjectView from "./ProjectView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectView id={id} />;
}
