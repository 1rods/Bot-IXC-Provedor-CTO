# Bot-IXC-Provedor-CTO
Bot telegram IXC Provedor

Bot para telegram que se alimenta da API do IXC Provedor, funciona para informar possiveis massivos na rede...
[CTO_ID:1, Total_Logins:10, Logins_off:6]
Nesse caso foi utilizado para que se ocorrer uma queda em uma CTO acima de 60%, informar ser um possivel massivo(Obs: os outros 40% pode se tratar de clientes cadastrados errados).

Para utilizar o bot, precisará de um TOKEN_Telegram && ID_grupo_telegram, Token_IXC_Provedor

Exemplo da mensagem exibida no grupo:
https://prnt.sc/7LJ53LuNdS9L

Utilizar:
npm i node-telegram-bot-api
node .
