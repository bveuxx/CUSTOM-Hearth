// esbuild's "dataurl" loader turns image imports into a data: URI string.
declare module "*.png" {
	const src: string;
	export default src;
}
