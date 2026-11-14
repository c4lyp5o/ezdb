import metadata from "../package.json";

if (!/^\d+\.\d+\.\d+$/.test(metadata.version) || metadata.license !== "MIT") {
	throw new Error("Expected a semantic version and MIT license");
}
const ref = process.env.GITHUB_REF || "";
if (ref.startsWith("refs/tags/") && ref !== `refs/tags/v${metadata.version}`) {
	throw new Error("Release tag must match package.json");
}
const changelog = await Bun.file(
	new URL("../CHANGELOG.md", import.meta.url),
).text();
if (!changelog.includes(metadata.version))
	throw new Error("Version missing from changelog");
console.log(`Release metadata valid: ${metadata.version} / MIT`);
