import { cancel, log, spinner } from "@clack/prompts";
import { WebCreationOptions } from "../utils/types";
import degit from "degit";
import { BASE_REPO } from "../utils/constants";
import { cyan, bgMagentaBright, black } from "picocolors";

export default async function create_web(options: WebCreationOptions) {
    const s = spinner()
    s.start('Creating web app...')
    try {
        const url = `${BASE_REPO}/tree/main/examples/${options.template}`


        console.log('create_web.url', url)

        const emitter = degit(url, {
            mode: 'git',
            verbose: true,
        })

        emitter.on('warn', (error) => {

            log.error(bgMagentaBright(black('Error:')))
            console.error(error)
            cancel('Operation cancelled.')
            process.exit(0)
        })

        emitter.clone(options.path)

    } catch (error) {
        log.error(bgMagentaBright(black('Error:')))
        console.error(error)
        cancel('Operation cancelled.')
        process.exit(0)
    }
    s.stop(`${cyan(options.framework.slice(0, 1).toUpperCase() + options.framework.slice(1))} template created at ${options.path}`)
}
