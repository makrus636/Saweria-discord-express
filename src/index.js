require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Events, Collection, MessageFlags, REST, Routes } = require('discord.js');
const app = express();
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
] });

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = '1561467400254128259';
const host = '0.0.0.0';
const port = 3000;

// Saweria stream key
const STREAM_KEY = process.env.STREAM_KEY;

app.use(express.json());

app.post('/webhook', (req, res) => {
    const payload = req.body;
    const signatureHeader = req.headers['saweria-callback-signature'];

    if (signatureHeader) {
        const message = `${payload.version}${payload.id}${payload.amount_raw}${payload.donator_name}${payload.donator_email}`;

        const calculateSignature = crypto.createHmac('sha256', STREAM_KEY).update(message).digest('hex');

        if (calculateSignature !== signatureHeader) {
            console.log("❌ Signature tidak cocok! Request ilegal.")
            return res.status(401).send('Unauthorize Signature');
        }
    }
    const amount = payload.amount_raw;

    const message = `
    Terimakasih **${payload.donator_name}** atas support nya 🙏️,
    💵️Dana Rp${amount.toLocaleString('id-ID')} telah masuk.
    💬️Pesan: "${payload.message}"

    Hasil dana dari saweria akan dipergunakan untuk pembayaran tagihan hosting server.
    `;

    sendMessage(message, CHANNEL_ID);

    console.log('✅ Webhook Saweria Diterima!');
    console.log(`Dari: ${payload.donator_name} (${payload.donator_email})`);
    console.log(`Jumlah: Rp ${payload.amount_raw}`);
    console.log(`Pesan: "${payload.message}"`);
    
    res.status(200).send('OK');
});

// Discord js

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
})

const sendMessage = async (message, channelId) => {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        await channel.send(message);
    }
};

client.commands = new Collection();
const commands = [];

const folderPath = path.join(__dirname, 'commands');
const commandFolder = fs.readdirSync(folderPath);

for (const folder of commandFolder) {
    const commandsPath = path.join(folderPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const rest = new REST().setToken(TOKEN);

void (async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();

client.on(Events.InteractionCreate, async (interaction) => {
    console.log(`${interaction.user.globalName} Memanggil command "/${interaction.commandName}"`);
});

// command dasar "/ping, /server, /user"
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
		return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		}
    }
})

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!halo') {
        await message.channel.send('Halo juga! 👋️')
    } 
});


// Start express js dan login bot discord 
app.listen(port, host, () => {
    console.log('App running... OK!');
})

client.login(TOKEN);