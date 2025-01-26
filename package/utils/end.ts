import { CLIOptions } from "./types";
import * as p from 'picocolors'
import { note } from "@clack/prompts";


export default function end_note({ project }: { project: CLIOptions }) {



    const next_steps = `cd ${project.path}        \n${project.install ? '' : 'pnpm install\n'}git init\nCreate a new git repo and push your code to it\nnpm run build`;

    note(next_steps, 'Next steps.');

    const end_notes = [`Discord: ${p.underline(p.cyan('https://zephyr-cloud.io/discord'))}`,
    `Documentation: ${p.underline(p.cyan('https://zephyr-cloud.io/docs'))}`,
    `Open an issue: ${p.underline(p.cyan('https://github.com/ZephyrCloudIO/create-zephyr-apps/issues'))}`
    ]

    note(Object.values(end_notes).join('\n'), 'Problems?')
}