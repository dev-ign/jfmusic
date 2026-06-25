#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svgOutputPath = resolve(
  projectRoot,
  "src/components/SignatureLogo/signature-logo.svg",
);
const pathsOutputPath = resolve(
  projectRoot,
  "src/components/SignatureLogo/signaturePaths.ts",
);

const svgArgument = process.argv[2];

if (!svgArgument) {
  console.error(
    "Usage: node scripts/generate-signature-svg.mjs <path-to-flattened-signature.svg>",
  );
  process.exitCode = 1;
} else {
  generate(resolve(process.cwd(), svgArgument));
}

function generate(svgPath) {
  const sourceSvg = readFileSync(svgPath, "utf8");
  const document = new JSDOM(sourceSvg, {
    contentType: "image/svg+xml",
  }).window.document;
  const svg = document.querySelector("svg");

  if (!svg) {
    throw new Error(`No <svg> root found in ${svgPath}`);
  }

  const viewBox = svg.getAttribute("viewBox");

  if (!viewBox) {
    throw new Error(`No viewBox found in ${svgPath}`);
  }

  const paths = Array.from(svg.querySelectorAll("path")).map(
    (pathElement, index) => {
      const d = pathElement.getAttribute("d");
      const transform = pathElement.getAttribute("transform");

      if (!d) {
        throw new Error(`Path ${index + 1} in ${svgPath} is missing d`);
      }

      return {
        id: `jona-ferreira-${index + 1}`,
        d,
        ...(transform ? { transform } : {}),
      };
    },
  );

  if (paths.length === 0) {
    throw new Error(`No <path> elements found in ${svgPath}`);
  }

  mkdirSync(dirname(svgOutputPath), { recursive: true });
  writeFileSync(
    svgOutputPath,
    sourceSvg.endsWith("\n") ? sourceSvg : `${sourceSvg}\n`,
    "utf8",
  );
  writeFileSync(pathsOutputPath, renderTypeScript(viewBox, paths), "utf8");

  console.log(`Imported ${paths.length} flattened SVG paths.`);
  console.log(`viewBox: ${viewBox}`);
}

function renderTypeScript(viewBox, paths) {
  const entries = paths
    .map(({ id, d, transform }) => {
      const fields = [
        `id: ${JSON.stringify(id)}`,
        `d: ${JSON.stringify(d)}`,
      ];

      if (transform) {
        fields.push(`transform: ${JSON.stringify(transform)}`);
      }

      return `  { ${fields.join(", ")} },`;
    })
    .join("\n");

  return `// Parsed from the uploaded flattened Jona Ferreira SVG; do not edit by hand.

export type SignaturePath = Readonly<{
  id: string;
  d: string;
  transform?: string;
}>;

export const SIGNATURE_VIEW_BOX = ${JSON.stringify(viewBox)} as const;

export const SIGNATURE_PATHS = [
${entries}
] as const satisfies readonly SignaturePath[];
`;
}
