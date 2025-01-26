
import { CLIOptions, WebCreationOptions, ReactNativeCreationOptions } from "../utils/types";
import create_web from "./create-web"
import create_react_native from "./create-react-native"
import { TEMPLATES } from "../utils/constants";
import { cancel, log } from "@clack/prompts";
import * as p from "picocolors";
import install from "../utils/install";


export default async function create(options: CLIOptions) {
    let web_options = {} as WebCreationOptions
    let react_native_options = {} as ReactNativeCreationOptions

    if (!options.path) {
        log.error(p.bgMagentaBright(p.black('Error:')))
        console.error('Path is required')
        cancel('Operation cancelled.')
        process.exit(0)
    }

    if (options.type === 'web') {

        if (!options.templates) {
            log.error('Templates are required')
            cancel('Operation cancelled. Run the command again and select a template.')
            process.exit(0)
        }

        Object.assign(web_options, {
            path: options.path,
            template: options.templates,
            framework: TEMPLATES[options.templates as keyof typeof TEMPLATES].framework
        })

        await create_web(web_options)

    } else if (options.type === 'react-native') {


        Object.assign(react_native_options, {
            path: options.path,
            //host_name: options.host_name,
            //remote_names: options.remote_names
        })

        create_react_native(react_native_options)
    }


    install({ project: options })
}
