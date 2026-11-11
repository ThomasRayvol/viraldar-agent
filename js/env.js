// Importé en premier par index.ts. Un réglage laissé vide par l'utilisateur (plugin Claude Code, extension Claude
// Desktop) peut arriver tel quel (« ${user_config.dossier} ») ou vide : dans les deux cas, on retombe sur le défaut.
for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VIRALDAR_") && (v === undefined || v.trim() === "" || /^\$\{[^}]*\}$/.test(v.trim())))
        delete process.env[k];
}
export {};
