/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verifica status da API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API online
 */

// ==============================
// AUTH ENDPOINTS
// ==============================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: senha123
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Campos inválidos
 *       409:
 *         description: Email já cadastrado
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login de usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login bem sucedido, retorna token JWT
 *       401:
 *         description: Credenciais inválidas
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obter usuário atual
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *       401:
 *         description: Token não fornecido
 *       403:
 *         description: Token inválido
 */

// ==============================
// ACCOUNTS ENDPOINTS
// ==============================

/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: Listar todas as contas
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Lista de contas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Account'
 *   post:
 *     summary: Criar nova conta
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_name
 *               - document
 *               - bank_code
 *               - agency
 *               - account_number
 *             properties:
 *               holder_name:
 *                 type: string
 *                 example: João Silva
 *               document:
 *                 type: string
 *                 example: "12345678901"
 *               bank_code:
 *                 type: string
 *                 example: "001"
 *               agency:
 *                 type: string
 *                 example: "1234"
 *               account_number:
 *                 type: string
 *                 example: "12345-6"
 *               account_type:
 *                 type: string
 *                 enum: [checking, savings]
 *                 default: checking
 *               initial_balance:
 *                 type: number
 *                 default: 0
 *     responses:
 *       201:
 *         description: Conta criada
 *       400:
 *         description: Dados inválidos
 */

/**
 * @swagger
 * /api/accounts/{id}:
 *   get:
 *     summary: Buscar conta por ID
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Dados da conta
 *       404:
 *         description: Conta não encontrada
 *   put:
 *     summary: Atualizar conta
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               holder_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conta atualizada
 *   delete:
 *     summary: Desativar conta
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conta desativada
 */

/**
 * @swagger
 * /api/accounts/{id}/balance:
 *   get:
 *     summary: Consultar saldo
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Saldo da conta
 */

/**
 * @swagger
 * /api/accounts/{id}/statement:
 *   get:
 *     summary: Consultar extrato
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Extrato da conta com transações
 */

// ==============================
// TRANSACTIONS ENDPOINTS
// ==============================

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Listar transações
 *     tags: [Transactions]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, withdraw, transfer, pix]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Lista de transações
 */

/**
 * @swagger
 * /api/transactions/deposit:
 *   post:
 *     summary: Realizar depósito
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - account_id
 *               - amount
 *             properties:
 *               account_id:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Depósito realizado
 */

/**
 * @swagger
 * /api/transactions/withdraw:
 *   post:
 *     summary: Realizar saque
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - account_id
 *               - amount
 *             properties:
 *               account_id:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Saque realizado
 *       400:
 *         description: Saldo insuficiente
 */

/**
 * @swagger
 * /api/transactions/transfer:
 *   post:
 *     summary: Realizar transferência
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - source_account_id
 *               - destination_account_id
 *               - amount
 *             properties:
 *               source_account_id:
 *                 type: string
 *                 format: uuid
 *               destination_account_id:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transferência realizada
 */

/**
 * @swagger
 * /api/transactions/pix:
 *   post:
 *     summary: Realizar PIX
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - source_account_id
 *               - pix_key
 *               - amount
 *             properties:
 *               source_account_id:
 *                 type: string
 *                 format: uuid
 *               pix_key:
 *                 type: string
 *                 description: CPF/CNPJ do destinatário
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: PIX realizado
 *       404:
 *         description: Destinatário não encontrado
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renovar access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: Refresh token obtido no login
 *     responses:
 *       200:
 *         description: Novos tokens gerados
 *       401:
 *         description: Refresh token inválido ou expirado
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout - Revogar refresh token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: Opcional - revoga token específico. Se não enviado, revoga todos os tokens do usuário.
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *       401:
 *         description: Token de acesso não fornecido
 */
