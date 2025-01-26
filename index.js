const TelegramBot = require('node-telegram-bot-api');
const request = require('request');

const telegramToken = 'TOKEN_TELEGAM';
const IdChat = 'ID_CHAT_TELEGRAM';
const bot = new TelegramBot(telegramToken, { polling: true });
const systemToken = 'TOKEN_IXC-PRVEDOR';
const HOST = 'https://SEU_DOMINIO/webservice/v1'; // Aqui para colocar o link de dominio do seu ixc-provedor
const CACHE_DURATION = 5 * 60 * 60 * 1000; // Esse tempo é para se acontecer de informar [CTO:1] as 9:00, se não for resolvido dentro de 5hrs, ele irá informar novamente as 14:00, vc pode ajustar "5 * 60 * 60 * 1000" só alterar o primeiro valor. "2 * 60 * 60 * 1000"Assim seria 2hs

const cache = {};

function logProgress(currentStep, totalSteps, message) {
    const percent = ((currentStep / totalSteps) * 100).toFixed(2);
    console.log(`[${percent}%] ${message}`);
}

function fetchAllRadUsuarios(callback) {
    let page = 1;
    const rp = 100;
    const allData = [];

    function fetchPage() {
        const options = {
            method: 'POST',
            url: `${HOST}/radusuarios`,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Basic ' + systemToken,
                ixcsoft: 'listar'
            },
            body: {
                qtype: 'radusuarios.id',
                query: '0',
                oper: '>',
                page: page.toString(),
                rp: rp.toString(),
                sortname: 'radusuarios.id',
                sortorder: 'desc'
            },
            json: true
        };

        request(options, (error, response, body) => {
            if (error) return callback(error, null);

            const registros = body.registros || [];
            if (registros.length > 0) {
                allData.push(...registros);

                if (registros.length === rp) {
                    page++;
                    logProgress(page, 10, `Página ${page} de radusuarios carregada.`);
                    fetchPage();
                } else {
                    callback(null, allData);
                }
            } else {
                callback(null, allData);
            }
        });
    }

    fetchPage();
}

function fetchClientContract(contractId, callback) {
    const options = {
        method: 'POST',
        url: `${HOST}/cliente_contrato`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + systemToken,
            ixcsoft: 'listar'
        },
        body: {
            qtype: 'cliente_contrato.id',
            query: contractId,
            oper: '=',
            page: '1',
            rp: '1',
            sortname: 'cliente_contrato.id',
            sortorder: 'asc'
        },
        json: true
    };

    request(options, (error, response, body) => {
        if (error) return callback(error, null);
        callback(null, body);
    });
}

function isCached(caixa) {
    const now = Date.now();
    if (cache[caixa] && now - cache[caixa] < CACHE_DURATION) {
        return true;
    }
    cache[caixa] = now;
    return false;
}

function analyzeRadUsuarios(chatId) {
    logProgress(1, 6, "Iniciando análise dos radusuarios...");

    fetchAllRadUsuarios((error, data) => {
        logProgress(2, 6, "Todos os radusuarios foram carregados.");

        const radUsuarios = data || [];
        const caixasMap = {};

        radUsuarios.forEach(user => {
            const { id_caixa_ftth, ativo, online, id_contrato, login } = user;

            if (!id_caixa_ftth || id_caixa_ftth === '0') {
                return;
            }

            if (!caixasMap[id_caixa_ftth]) {
                caixasMap[id_caixa_ftth] = [];
            }

            caixasMap[id_caixa_ftth].push({ id_caixa_ftth, ativo, online, id_contrato, login });
        });

        logProgress(3, 6, "Organização de usuários por caixas FTTH concluída.");

        Object.keys(caixasMap).forEach((caixa) => {
            const usersInCaixa = caixasMap[caixa];
            const totalUsersInCaixa = usersInCaixa.length;
            const validUsers = usersInCaixa.filter(user => user.ativo === 'S' && user.online === 'N');
            const offlineUsers = [];
        
            const promises = validUsers.map((user) => {
                return new Promise((resolve, reject) => {
                    fetchClientContract(user.id_contrato, (error, contractData) => {
                        if (error) {
                            reject(error);
                            return;
                        }
        
                        const registros = contractData?.registros || [];
                        const statusInternet = registros[0]?.status_internet || null;
        
                        if (statusInternet === 'A') {
                            offlineUsers.push(user);
                        }
                        resolve();
                    });
                });
            });
        
            Promise.allSettled(promises)
                .then(() => {
                    const offlinePercentage = (offlineUsers.length / totalUsersInCaixa) * 100;
        
                    if (totalUsersInCaixa > 0 && offlinePercentage > 60) {
                        if (isCached(caixa)) {
                            return;
                        }
                        const loginsOffline = offlineUsers.map(user => user.login).join(', ');
                        const message = `\ud83d\udce6 Caixa FTTH: ${caixa}\n` +
                            `- Total de clientes na caixa: ${totalUsersInCaixa}\n` +
                            `- Clientes válidos analisados: ${validUsers.length}\n` +
                            `- Clientes offline: ${offlineUsers.length}\n` +
                            `- Percentual offline: ${offlinePercentage.toFixed(2)}%\n` +
                            `- Logins offline: ${loginsOffline}`;
                        bot.sendMessage(chatId, message);
                    }
                })
                .catch((error) => {
                    bot.sendMessage(chatId, `Erro durante a análise: ${error.message}`);
                });
        });

        logProgress(6, 6, "Análise dos radusuarios concluída.");
    });
}

function startBot() {
    const chatId = IdChat;
    analyzeRadUsuarios(chatId);
}

setInterval(() => {
    startBot();
}, 60000);
