import { cancel, log, spinner } from "@clack/prompts";
import { WebCreationOptions } from "../utils/types";
import degit from "degit";
import { BASE_REPO } from "../utils/constants";
import { cyan } from "picocolors";

export default async function create_web(options: WebCreationOptions) {
    const s = spinner()
    s.start('Creating web app...')
    try {

        const emitter = degit(`${BASE_REPO}/${options.template}` as string, {
            cache: false,
            force: true,
            verbose: true,
            mode: 'tar'
        })

        emitter.on('warn', (error) => {
            log.error(error as unknown as string)
            cancel('Operation cancelled.')
            process.exit(0)
        })

        emitter.clone(options.path)

    } catch (error) {
        log.error(error as string)
        cancel('Operation cancelled.')
        process.exit(0)
    }
    s.stop(`${cyan(options.framework.slice(0, 1).toUpperCase() + options.framework.slice(1))} template created at ${options.path}`)
}