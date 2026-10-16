# Pesk

Aplicativo mobile Expo/React Native para cadastro de pescadores. O projeto inclui uma API HTTP em Fastify e usa Firebase Authentication e Cloud Firestore.

## Arquitetura em camadas

O backend é organizado em camadas. As dependências seguem Presentation → Business → Domain/Ports, com os adaptadores de Data/Infrastructure implementando as portas do core. A apresentação não acessa Firestore.

- `src/backend/server`: camada de apresentação HTTP Fastify (rotas, schemas, autenticação da requisição e códigos HTTP).
- `src/core/business`: camada de negócio/aplicação, incluindo `GerenciarPerfilUsuarioService` e as portas dos repositórios/verificador de token.
- `src/core/domain`: modelos `Usuario`, `Desafio`, `Participacao`, `Especie` e `RegistroPesca`, sem dependência de Fastify ou Firebase.
- `src/backend/data` e `src/backend/auth`: adaptadores de infraestrutura para Firestore Admin e validação de ID tokens.
- `src/frontend` e os adaptadores em `src/backend/config` e `src/backend/data/UsuarioRepositoryFirebase.ts`: cliente Expo. Esse repositório de cadastro do cliente só cria a conta Firebase Auth e chama a API; o servidor persiste o perfil.
- `firestore.rules`: bloqueia acesso direto dos clientes aos perfis; somente o servidor com Firebase Admin SDK os lê e grava.

A senha é usada somente para criar a conta no Firebase Authentication. Ela não é enviada à API nem gravada no Firestore. O app envia o nome e um Firebase ID token; a API verifica o token e obtém UID/e-mail da identidade verificada.

## Pré-requisitos

- Node.js 20 ou superior e npm.
- Um projeto Firebase com Email/Senha habilitado no Authentication e Cloud Firestore criado.
- Credenciais de Firebase Web para o app e credenciais de servidor para a API.

## Configurar e executar a API

Na raiz do repositório:

1. Instale as dependências do backend: `npm --prefix src/backend install`.
2. Copie `src/backend/.env.example` para `src/backend/.env` e informe `FIREBASE_PROJECT_ID` e o nome exato do bucket em `FIREBASE_STORAGE_BUCKET` (Firebase Console → Storage). Ative o Cloud Firestore e o Firebase Storage no projeto.
3. Disponibilize credenciais para o Firebase Admin SDK. Em desenvolvimento, use Application Default Credentials (`gcloud auth application-default login`) ou defina `GOOGLE_APPLICATION_CREDENTIALS` com o caminho absoluto de uma chave JSON de conta de serviço. Nunca coloque essa chave no app, no `.env` do Expo ou no Git.
4. Inicie o servidor: `npm run dev:backend`.
5. Verifique `http://localhost:3000/health`; a resposta esperada é `{"status":"ok"}`.

A API escuta por padrão em `0.0.0.0:3000`. Configure `API_CORS_ORIGIN` com as origens web autorizadas antes de publicar; sem essa configuração, CORS fica desabilitado (apps nativos não dependem de CORS). Em ambiente de produção, use identidade de workload/ADC em vez de distribuir chaves de conta de serviço.

### Recursos de pescaria e formato do Firestore

O banco começa vazio; as coleções e documentos são criados quando a API recebe gravações. Os documentos são organizados assim:

- `desafios/{desafioId}`: nome, código de convite único, `donoId`, datas de início/fim, status, critérios de ranking e criação.
- `desafios/{desafioId}/participacoes/{uid}`: uma participação por pescador, criada também para o organizador.
- `especies/{especieId}`: nome, peso máximo de referência em kg e sinalizador `ativa`.
- `registros_pesca/{registroId}`: referências de desafio/participação/pescador/espécie, peso em kg, comprimento opcional em cm, local, data/hora, URL da foto e status. A foto fica em Firebase Storage, em `desafios/{desafioId}/registros/`.

O desenho inclui também contestação; ela não faz parte deste recorte do CRUD de desafio/captura e ainda não tem rotas. Os registros são criados com status `valido`; a aplicação atual não implementa abertura/decisão de contestação.

### CRUD de desafios (competições)

Todos exigem `Authorization: Bearer <Firebase ID token>`; IDs de pescador vêm do token, nunca do corpo.

| Método   | Rota                                        | Comportamento                                                                                                                                                                 |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/desafios`                             | Cria desafio, código de convite e participação do organizador. Recebe `nome`, `inicio`, `fim` em ISO 8601 e, opcionalmente, `criteriosRanking` (`peso_total`, `maior_peixe`). |
| `GET`    | `/api/desafios`                             | Lista desafios organizados ou dos quais o usuário participa.                                                                                                                  |
| `GET`    | `/api/desafios/:desafioId`                  | Retorna detalhe, participantes, ranking por peso total e melhor peixe; rankings são calculados em tempo de leitura, não persistidos.                                          |
| `PATCH`  | `/api/desafios/:desafioId`                  | Atualiza nome, datas e critérios somente para o organizador, antes do início.                                                                                                 |
| `POST`   | `/api/desafios/entrar`                      | Entra com `{ "codigoConvite": "..." }`, somente antes do início; a mesma pessoa não entra duas vezes.                                                                         |
| `GET`    | `/api/desafios/:desafioId/participantes`    | Lista participantes para integrantes do desafio.                                                                                                                              |
| `DELETE` | `/api/desafios/:desafioId/participantes/me` | Sai antes do início; organizador não pode sair e deve cancelar.                                                                                                               |
| `POST`   | `/api/desafios/:desafioId/cancelar`         | Cancela desafio pelo organizador. Não apaga os registros existentes.                                                                                                          |

O status começa como `aberto`, passa para `ativo` na primeira requisição após o início se houver pelo menos duas participações e vira `encerrado` após a data final. Se chegar ao início com menos de duas pessoas, o serviço o marca como `cancelado`. Essa transição é avaliada sob demanda em chamadas à API; não há job agendado.

### CRUD de espécies (suporte ao registro)

`GET /api/especies` lista espécies; `POST /api/especies` cria com `nome` e `pesoMaxReferenciaKg`; `PATCH /api/especies/:especieId` atualiza os campos e `ativa`. Não existe exclusão física: espécies referenciadas por capturas devem ser desativadas. No protótipo, qualquer usuário autenticado pode manter o catálogo; ainda não foi definido papel de administrador.

### CRUD de capturas

| Método   | Rota                                                    | Comportamento                                                                                                                                                |
| -------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST`   | `/api/desafios/:desafioId/registros`                    | Cria captura do usuário autenticado com `especieId`, `pesoKg`, `local`, `dataHora` ISO 8601, foto `fotoBase64` e `fotoMimeType`; `comprimentoCm` é opcional. |
| `GET`    | `/api/desafios/:desafioId/registros?participanteId=...` | Lista capturas de um participante; se o parâmetro for omitido, lista todas. Solicitante e alvo precisam participar do desafio.                               |
| `PATCH`  | `/api/registros/:registroId`                            | Atualiza os dados do próprio registro; foto é opcional na atualização.                                                                                       |
| `DELETE` | `/api/registros/:registroId`                            | Apaga o registro e tenta remover a foto.                                                                                                                     |

O registro exige desafio ativo, participação, espécie ativa, peso maior que zero e não acima da referência, data dentro do desafio e foto JPEG/PNG/WebP de até 4 MB. Cada pescador pode registrar no máximo 10 capturas por dia UTC; a contagem é protegida também por transação no repositório Firestore. Só o autor pode editar/apagar e somente enquanto o desafio está ativo. A foto é enviada no corpo JSON em base64 e armazenada no Firebase Storage. O limite HTTP do backend é 7 MB para acomodar a codificação.

O ranking considera registros `valido`: peso total decrescente, desempate por quantidade de peixes; melhor peixe por maior peso, desempate pelo registro mais antigo. As unidades armazenadas são kg e cm. Os índices compostos para consultas de registros estão em `firestore.indexes.json`.

### CRUD de perfil

Todos os endpoints de perfil exigem `Authorization: Bearer <Firebase ID token>`. O UID e o e-mail vêm do token validado, nunca do corpo da requisição. A API acessa exclusivamente o perfil do próprio usuário autenticado.

| Método   | Rota               | Comportamento                                                                 |
| -------- | ------------------ | ----------------------------------------------------------------------------- |
| `POST`   | `/api/usuarios/me` | Cria o perfil com `{ "nome": "Nome completo" }`; retorna `409` se já existir. |
| `GET`    | `/api/usuarios/me` | Busca o perfil; retorna `404` se não existir.                                 |
| `PATCH`  | `/api/usuarios/me` | Atualiza o nome; preserva `criadoEm` e atualiza `atualizadoEm`.               |
| `DELETE` | `/api/usuarios/me` | Exclui o documento do perfil; não exclui a conta do Firebase Authentication.  |

Os schemas HTTP rejeitam campos extras (como `uid` e `email`) e nomes vazios. A camada de negócio também valida o nome e traduz ausência/conflito em erros de domínio; a apresentação os converte em `400`, `404` ou `409`. `GET /health` é um health check sem autenticação.

## Configurar e executar o app

1. Na raiz, instale as dependências mobile: `npm install`.
2. Copie `.env.example` para `.env` e preencha as seis variáveis `EXPO_PUBLIC_FIREBASE_*` com a configuração do app Web no Firebase Console.
3. Defina `EXPO_PUBLIC_PESK_API_URL` para a URL alcançável pela aplicação:
   - navegador/iOS Simulator: `http://localhost:3000` (ajuste se necessário);
   - emulador Android: `http://10.0.2.2:3000`;
   - dispositivo físico: `http://<IP-da-sua-maquina-na-rede>:3000`.
4. Em outro terminal, inicie o app: `npm start`.

O servidor e o app precisam estar em execução ao mesmo tempo. Reinicie o Expo depois de alterar `.env`. As variáveis `EXPO_PUBLIC_*` são incluídas no cliente e não podem conter segredos.

## Testes e validação

- App: `npm test -- --runInBand`
- Tipos do app: `npx tsc --noEmit`
- Backend: `npm run test:backend`
- Tipos do backend: `npm run typecheck:backend`
- Build do backend: `npm run build:backend`

## Publicar regras do Firestore

Após conferir o projeto Firebase correto, execute `firebase deploy --only firestore:rules,firestore:indexes`. A configuração `firebase.json` aponta para as regras da raiz e para os índices. As regras negam acesso direto do cliente; operações feitas pela API com Firebase Admin SDK não são avaliadas pelas regras do Firestore. Proteja a API verificando tokens e validando autorização em cada endpoint.
