/** Registreert de alias-resolver voor de testrunner (zie alias-loader.mjs). */
import { register } from "node:module";
register("./alias-loader.mjs", import.meta.url);
