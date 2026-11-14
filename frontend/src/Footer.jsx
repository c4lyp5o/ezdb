import metadata from "../../package.json";

export default function Footer() {
	return (
		<footer className="flex shrink-0 items-center justify-center gap-2 border-t border-line py-5 text-[13px] text-mute">
			<span className="font-mono">
				{metadata.version ? `v${metadata.version}` : "dev"}
			</span>
			<span aria-hidden="true">·</span>
			<span title="This project has not been published to GitHub yet">
				Source not published
			</span>
		</footer>
	);
}
