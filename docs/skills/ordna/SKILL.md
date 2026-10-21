---
name: ordna
description: "Use when a directory holds .ordna/ or tasks/*.md, when the user names ordna, a kanban, a board or a card, or when work needs a board that does not exist yet. Ordna is this machine's kanban provider: it creates the board, reads it, edits tasks and moves cards between columns."
---

# Ordna

Board derivado de arquivos: cada task é um markdown em `tasks/`, cada coluna é um valor de `status`. Não existe estado de board em lugar nenhum: o arquivo é a fonte de verdade e o Kanban é **projeção**. O CLI `ordna` valida status e dependência por cima desses mesmos arquivos.

## Granularidade

Leia na menor granularidade que responde à pergunta: no mesmo board, abrir os arquivos custa mais de uma ordem de grandeza a mais que listar.

| Pergunta | Como responder |
|---|---|
| O que existe / o que está pendente | `ordna ls`, `ordna ls -s <status>` |
| O que essa task diz | `ordna show <id>` |
| Vou **editar** o corpo | Read + Edit em `tasks/<id>.md` |

`ordna ls` e `ordna show` respondem no terminal. A TUI (`ordna`, `ordna board`) é interativa: quem abre é o usuário.

## Storage

`.ordna/config.yaml` pode trazer `storage: file` (padrão) | `hybrid` | `namespace`. Nos dois primeiros as tasks são arquivos em `tasks/`. Em **`namespace` não existe arquivo**: as tasks vivem em `refs/ordna/tasks/<id>` e tudo passa pelo CLI. Confirme o modo antes de abrir arquivo.

## Ciclo de uma task

1. `ordna create "<título>"` cria com o esqueleto (`## Goal`, `## Acceptance Criteria`, `## Notes`, `## Progress`). Flags: `-p high|medium|low`, `-t <tag...>`, `-d <dependência...>`, `-s <status>`, `-a <nome>`. O comando aceita só o título; o corpo detalhado você escreve editando `tasks/<id>.md`.
2. Lê `## Comments` (abaixo) e executa.
3. Registra em `## Progress` o que foi feito, marca os checkboxes de `## Acceptance Criteria` que passaram, e põe `updated_at` na data de hoje.
4. `ordna move <id> <status>`.

Passo 3 antes do 4, sempre: task fechada sem Progress não conta como feita.

`ordna commit -m "msg"` faz `git add tasks/` + commit, e roda quando o usuário pede.

Anexos: `ordna attach <id> <arquivo>`, `ordna attachments <id>`, `ordna detach <id> <attachmentId>`. O resto do CLI (`assign`, `web`, filtros de `ls`) sai de `ordna --help` e `ordna <cmd> --help`.

## Comentários

A conversa de um card vive na seção `## Comments`, criada pelo primeiro `ordna comment` e append-only, uma linha por fala:

```markdown
## Comments
- **@ana** _2026-08-13_ — o parâmetro de paginação começa em 1 no serviço, cuidado
- **@claude** _2026-08-13_ — ajustado no adapter
```

- Leia `## Comments` **antes** de executar um card: é onde o usuário corrige rumo, e a correção costuma chegar depois do card já estar escrito. Card criado antes do `ordna comment` pode trazer a conversa em `## Notes`: leia também.
- Responda com `ordna comment <id> "<texto>" --as claude` ao terminar ou travar. Sem `--as`, o autor é `$ORDNA_AUTHOR` ou o `user.name` do git, ou seja, o nome do usuário, não o seu.
- Nunca edite nem apague comentário anterior. Com storage `file`/`hybrid`, o `git log -p` do arquivo da task é a trilha de auditoria.

## Colunas e dependências

Padrão `todo → doing → done`. `statuses:` no config redefine as colunas na ordem, e a primeira é o default de tasks novas.

- O **último status da lista é o terminal**. Mover pra ele com `depends_on` em aberto é rejeitado pelo CLI.
- `archived` é reservado: sempre aceito, e filtrado das demais visões.

## Qual board

Um board por diretório: o `ordna` lê `<cwd>/.ordna/config.yaml`, e não existe flag `--cwd`. Boards são independentes entre si: IDs, colunas e contadores próprios. Quando o cwd não for o board que o usuário quer, pergunte antes de criar.

## Criar um board

`ordna init` na pasta que vai receber o board: cria `.ordna/config.yaml` e `tasks/`. Depois escreva o `config.yaml` com as colunas e o prefixo daquele trabalho:

```yaml
tasksDir: tasks
storage: file
idPrefix: TASK          # os IDs viram TASK-001, TASK-002…
zeroPaddedIds: 3
statuses: [todo, doing, done]
webTitle: ideal-integracao-neogrid-006939   # título da aba do `ordna web`
```

Boards de contexto diferente merecem `idPrefix` diferente: é o que deixa o ID citável fora do board (em commit, documento, conversa) sem ambiguidade.

`webTitle` dá nome à aba do navegador e separa os boards abertos lado a lado. O valor é o nome da customização, o `<slug>` de `.claude/plans/<slug>/`; sem plano, o slug ou ticket do trabalho em curso. Board sem a chave a recebe na hora em que você sobe o `ordna web` nele. CLI sem suporte à chave a ignora.

Uma pasta pode apontar pro board de outra: `tasksDir: ../outra/tasks`. Serve pra rodar `ordna` de um lugar conveniente sem mover os arquivos.

## Referência

Frontmatter campo a campo, compatibilidade Backlog.md, todas as chaves de config, storage em detalhe: `reference.md`, nesta pasta.
