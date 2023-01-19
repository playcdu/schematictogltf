import {exec} from "child_process";
import obj2gltf from "obj2gltf";
import chalk from 'chalk';
import * as fs from "fs";
import gltfPipeline from "gltf-pipeline";
import prompts from "prompts";
import ora from "ora";
import fse from "fs-extra/esm"
import path from "path";


function execShellCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, {maxBuffer: 1024 * 50000}, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}

(async () => {
    const response = await prompts([
        {
            type: 'text',
            name: 'schematicfile',
            message: 'Enter the filename of the schematic',
            initial: "BrandenburgerTor"
        },
        {
            type: 'text',
            name: 'minecraftdir',
            message: 'Enter your minecraft directory. (Please ensure, you have the version 1.12.2 installed)',
            initial: process.env.APPDATA + "\\.minecraft\\"
        },
        {
            type: 'toggle',
            name: 'snow',
            message: 'Should the snowy attribute be added?',
            initial: false
        },
    ]);

    if(!fs.existsSync("./schematics/" + response.schematicfile + ".schematic")) {
        console.log(chalk.red('The entered file does not exit.'))
    }

    let minecraft = response.minecraftdir
    let schematicName = response.schematicfile
    let snow = response.snow



    console.log(chalk.green(`Converting ${schematicName}`))


    let dir = [`./out/`,`./out/tmp/`,`./schematics/`,`./out/tmp/obj/`,`./out/tmp/obj/${schematicName}`,`./out/tmp/gltf/`,`./out/finished/`];
    for (let i = 0; i < dir.length; i++) {
        if (!fs.existsSync(dir[i])){
            fs.mkdirSync(dir[i], { recursive: true });
            console.log("Folder "+dir[i]+" created")
        }
    }

    let spinner = ora('Converting schematic file to obj').start();

    await execShellCommand(`java -jar schem2obj.jar -minecraftFolder ${minecraft} -i ./schematics/${schematicName}.schematic -o ./out/tmp/obj/${schematicName}/${schematicName}.obj ${snow ? "-snowy" : ""}`)

    while (!fs.existsSync(`./out/tmp/obj/${schematicName}/${schematicName}.obj`)) {
        spinner.text = "Waiting for obj to exist"
        continue;
    }

    spinner.text = "Converting obj to gltf"
    obj2gltf(`./out/tmp/obj/${schematicName}/${schematicName}.obj`).then(function (gltf) {
        const data = Buffer.from(JSON.stringify(gltf));
        fs.writeFileSync(`./out/tmp/gltf/${schematicName}.gltf`, data);
        spinner.text = "Compressing gltf file"

        const processGltf = gltfPipeline.processGltf;
        const gltfe = fse.readJsonSync(`./out/tmp/gltf/${schematicName}.gltf`);
        const options = {
            dracoOptions: {
                compressionLevel: 10,
            },
        };
        processGltf(gltfe, options).then(function (results) {
            fse.writeJsonSync(`./out/finished/${schematicName}-draco.gltf`, results.gltf);
            spinner.succeed("Finished gltf conversion")

            const directory = './out/tmp';

            fs.readdir(directory, (err, files) => {
                if (err) throw err;

                for (const file of files) {
                    fs.unlink(path.join(directory, file), err => {
                        if (err) throw err;
                    });
                }
            });


        });

    });
})();

