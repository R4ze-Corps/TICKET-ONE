import { env } from "#env";
import { bootstrap } from "@constatic/base";
import "./constants.js";

console.log("------------------------------------------");
console.log("BOT INICIANDO - SISTEMA DE TICKETS ATIVO");
console.log("------------------------------------------");

await bootstrap({ meta: import.meta, env });
