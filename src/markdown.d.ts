// Markdown imported `with { type: "text" }` is its contents as a string.
declare module "*.md" {
  const content: string;
  export default content;
}
