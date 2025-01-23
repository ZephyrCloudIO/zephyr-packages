import { CLIOptions } from "./types";
import { spinner, log, cancel } from "@clack/prompts";
import { exec } from "node:child_process";
import { bgRed, black } from "picocolors"
export default function install({ project }: { project: CLIOptions }) {
    if (project.install) {

        const s = spinner();
        try {
            s.start(`Installing...`);
            exec(`cd ${project.path}`)
            exec(`pnpm install`)

            s.stop('Installed via pnpm');

        } catch (error) {
            log.error(bgRed(black('Error:')))
            console.error(error)
            cancel('Operation cancelled.')
            process.exit(0)
        }
    }
}