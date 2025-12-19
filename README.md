# MCP-Gas

MCP Server per Google Apps Script - permette a Claude di lavorare autonomamente sui progetti GAS.

## Funzionalita

- **Gestione Progetti**: Lista e naviga i tuoi progetti Google Apps Script
- **Lettura/Scrittura Codice**: Leggi e modifica i file sorgente (.gs, .html)
- **Esecuzione Funzioni**: Esegui funzioni direttamente (senza parametri)
- **Log Esecuzioni**: Visualizza lo storico delle esecuzioni con errori
- **Deploy Automatico**: Deploy automatico dopo ogni modifica
- **Sync GitHub**: Sincronizza automaticamente le modifiche su GitHub

## Prerequisiti

1. **Node.js** >= 18
2. **Clasp** installato e autenticato:
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
3. **Apps Script API** abilitata nel tuo progetto Google Cloud (opzionale, per eseguire funzioni)

## Installazione

```bash
cd Mcp-Gas
npm install
npm run build
```

## Configurazione Claude Desktop

Aggiungi al file `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gas": {
      "command": "node",
      "args": ["/path/to/Mcp-Gas/dist/index.js"]
    }
  }
}
```

## Tool Disponibili

| Tool | Descrizione |
|------|-------------|
| `gas_list_projects` | Lista tutti i progetti GAS |
| `gas_get_project` | Dettagli di un progetto specifico |
| `gas_read_file` | Legge un file sorgente |
| `gas_read_all_files` | Legge tutti i file di un progetto |
| `gas_update_file` | Modifica un file (auto-deploy) |
| `gas_create_file` | Crea un nuovo file |
| `gas_delete_file` | Elimina un file |
| `gas_list_functions` | Lista le funzioni disponibili |
| `gas_run_function` | Esegue una funzione |
| `gas_get_logs` | Storico esecuzioni |
| `gas_list_deployments` | Lista i deployment |
| `gas_deploy` | Crea un deployment |

## Esempi di Utilizzo

### Listare i progetti
```
Usa gas_list_projects per vedere tutti i miei progetti Apps Script
```

### Leggere il codice
```
Leggi tutti i file del progetto con script ID "1abc..."
```

### Modificare codice
```
Nel progetto "1abc...", aggiorna il file "Code" con questa nuova versione:
[codice]
```

### Eseguire una funzione
```
Esegui la funzione "myFunction" nel progetto "1abc..."
```

### Vedere i log
```
Mostrami gli ultimi log di esecuzione del progetto "1abc..."
```

## Note Importanti

### Per eseguire funzioni:
1. Il progetto deve avere un deployment HEAD attivo
2. L'Apps Script API deve essere abilitata
3. La funzione non deve richiedere parametri
4. Per funzioni che richiedono autorizzazioni (Drive, Gmail, ecc.), devi prima eseguirle manualmente una volta per concedere i permessi

### Sync GitHub:
Quando usi `gas_update_file` con il parametro `githubRepo`, le modifiche vengono automaticamente committate e pushate.

## Struttura Progetto

```
Mcp-Gas/
├── src/
│   ├── index.ts              # Entry point MCP server
│   ├── auth/
│   │   └── clasp-auth.ts     # Gestione credenziali Clasp
│   ├── tools/
│   │   ├── projects.ts       # list_projects, get_project
│   │   ├── code.ts           # read/write/create/delete files
│   │   ├── execute.ts        # run_function, list_functions
│   │   ├── logs.ts           # get_execution_logs
│   │   └── deploy.ts         # deploy, list_deployments
│   ├── google-api/
│   │   └── apps-script.ts    # Client Apps Script API
│   └── github/
│       └── git-sync.ts       # Sincronizzazione GitHub
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
