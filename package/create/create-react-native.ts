import { ReactNativeCreationOptions } from "../utils/types";
import { spinner, cancel, log } from "@clack/prompts";
import degit from "degit";
import { red, bgRed, black } from "picocolors";
import { BASE_REPO, REPACK_REPO_PATH } from "../utils/constants";

export default function create_react_native(options: ReactNativeCreationOptions) {
    const s = spinner()
    s.start('Creating React Native app...')

    if (!options.path) {
        log.error(bgRed(black('Error:')))
        console.error('Path is required')
        cancel('Operation cancelled.')
        process.exit(0)
    }
    try {

        const emitter = degit(REPACK_REPO_PATH as string, {
            mode: 'git'
        })

        emitter.on('warn', (error) => {

            log.error(bgRed(black('Error:')))
            console.error(error as unknown as string)
            cancel('Operation cancelled.')
            process.exit(0)
        })

        emitter.clone(options.path)

    } catch (error) {

        log.error(bgRed(black('Error:')))
        console.error(error as string)
        cancel('Operation cancelled.')
        process.exit(0)
    }
    s.stop(`React Native app created at ${options.path}`)
}