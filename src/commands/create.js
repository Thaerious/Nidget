import FS from "fs";
import Path from "path";
import Logger from "@thaerious/logger";
import CONSTANTS from "../constants.js";
import loadJSON from "../loadJSON.js";
import settings from "../settings.js";
import replaceInFile from "../replaceInFile.js";
import mkdirIf from "../mkdirIf.js";
import { bfsObject } from "../bfsObject.js";
import { convertToDash, convertToPascal, convertDelimited } from "../names.js";
const logger = Logger.getLogger();

function create(records, commands, args) {
    switch (commands.peekCommand()) {
        case "component":
            commands.nextCommand();
            createComponent(commands.nextCommand(), args);
            break;
        case "view":
            commands.nextCommand();
            createView(commands.nextCommand(), args);
            break;
        default:
            createComponent(commands.nextCommand(), args);
            break;
    }
}

function createView(name, args) {
    const record = instantiateRecord(name, CONSTANTS.TYPE.VIEW);
    const viewFullPath = mkdirIf(record.dir.src, record.view);

    if (!FS.existsSync(viewFullPath)) {
        FS.copyFileSync(CONSTANTS.TEMPLATES.VIEW, viewFullPath);       
        replaceInFile(viewFullPath, "${style}", Path.join(record.dir.sub, record.style.dest));
        replaceInFile(viewFullPath, "${templates}", Path.join(record.dir.sub, CONSTANTS.FILENAME.TEMPLATES));
        replaceInFile(viewFullPath, "${script}", Path.join(record.dir.sub, record.es6));
    }

    if (!FS.existsSync(Path.join(record.dir.src, record.es6)))
        FS.writeFileSync(mkdirIf(record.dir.src, record.es6), "");

    if (!FS.existsSync(Path.join(record.dir.src, record.style.src)))        
        FS.writeFileSync(mkdirIf(record.dir.src, record.style.src), "");

    if (!FS.existsSync(Path.join(record.dir.src, CONSTANTS.FILENAME.BODY_FILE)))        
        FS.writeFileSync(mkdirIf(record.dir.src, CONSTANTS.FILENAME.BODY_FILE), "");
}

function createComponent(name, args) {
    logger.channel("very-verbose").log("\__ create widget");

    if (convertToDash(name).split("-").length < 2) {
        logger.channel(`standard`).log(`error: name must consist of two or more words (${name})`);
        process.exit();
    }

    const record = instantiateRecord(name, CONSTANTS.TYPE.COMPONENT);
    
    if (!args.flags["skip-templates"]) {       
        const viewPath = mkdirIf(record.dir.src,  record.view);
        if (!FS.existsSync(viewPath)) {
            FS.copyFileSync(Path.join(settings["node-modules"], CONSTANTS.MODULE_NAME, "templates/template.ejs"), viewPath);
            replaceInFile(viewPath, "${name_dash}", convertToDash(name));
            replaceInFile(viewPath, "${name_underscore}", convertDelimited(name, "_"));
            replaceInFile(viewPath, "${style_path}", Path.join(record.dir.sub, record.style.dest));
        }

        const scriptPath = Path.join(record.dir.src, record.es6);
        if (!FS.existsSync(scriptPath)) {
            FS.copyFileSync(Path.join(settings["node-modules"], CONSTANTS.MODULE_NAME, "templates/template.mjs"), scriptPath);
            replaceInFile(scriptPath, "${name_dash}", convertToDash(name));
            replaceInFile(scriptPath, "${name_pascal}", convertToPascal(name));
        }

        const stylePath = Path.join(record.dir.src, record.style.src);
        if (!FS.existsSync(stylePath)) {
            FS.copyFileSync(Path.join(settings["node-modules"], CONSTANTS.MODULE_NAME, "templates/template.scss"), stylePath);
            replaceInFile(stylePath, "${name_dash}", convertToDash(name));
        }
    }
}

function instantiateRecord(name, type){
    let record = buildRecord({}, name, type);
    const infoPath = Path.join(record.dir.src, CONSTANTS.NIDGET_INFO_FILE);
    const widgetInfo = loadInfoFile(infoPath);
    record = buildRecord(record, name, type);

    const current = bfsObject(widgetInfo, "fullName", record.fullName);
    if (current) return current;

    widgetInfo.components.push(record);
    FS.writeFileSync(infoPath, JSON.stringify(widgetInfo, null, 4));    
    return record;
}

/**
 * Build a record from a given name,
 * @param source Predefined fields
 * @param name component / view name
 * @param type view or componentn
 */
 function buildRecord(source, name, type) {   
    let root = "";
    if (name.indexOf("/") !== -1){
        const parsed = Path.parse(name);
        name = parsed.name;
        root = parsed.dir;
    }

    const record = {...{
        type: type,
        fullName: Path.join(root, convertToDash(name)),
        view: Path.join(name + ".ejs"),
        es6: Path.join(convertToPascal(name) + ".mjs"),
        style: {
            src: Path.join(name + ".scss"),
            dest: Path.join(name + ".css"),
        },
        dir : {
            sub : Path.join(settings["package"], root, convertToDash(name)),
            src : Path.join(settings[type === CONSTANTS.TYPE.COMPONENT ? "src" : "src"], settings["package"], root, convertToDash(name))
        },
        package: settings["package"],
    }, ...source};   

    if (type == CONSTANTS.TYPE.COMPONENT){
        record.tagName = convertToDash(name);
    }

    return record;
}

function loadInfoFile(path) {
    if (!FS.existsSync(path)) {
        const widgetInfo = {
            components: [],
        };
        mkdirIf(path);
        FS.writeFileSync(path, JSON.stringify(widgetInfo, null, 4));
    }

    return loadJSON(path);
}

export default create;
