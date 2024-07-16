/*

- AUTHOR: sarkyyy__
- WEBSITE: https://sarky.netlify.app
- DATE: 2024.04.07

*/

const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { QuickDB } = require('quick.db');
const { PermissionFlagsBits } = require('discord-api-types/v10');

const db = new QuickDB();
const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
    ],
    partials: ['MESSAGE', 'CHANNEL']
});

const commands = [
    {
        name: 'ticket',
        description: '- Hibajegy parancs.',
        options: [
            {
                name: 'setup',
                description: '- Beállítja a hibajegy rendszert a szerveren.',
                type: 'SUB_COMMAND',
                options: [
                    {
                        name: 'channel',
                        description: '---',
                        type: 'CHANNEL',
                        channelTypes: ['GUILD_TEXT'],
                        required: true,
                    },
                    {
                        name: 'message',
                        description: '---',
                        type: 'STRING',
                        required: true,
                    },
                    {
                        name: 'role',
                        description: '---',
                        type: 'ROLE',
                        required: true,
                    },
                ],
            },
            {
                name: 'panel',
                description: '- Elküldi a hibajegy panelt.',
                type: 'SUB_COMMAND',
            }
        ],
        default_member_permissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'say',
        description: '- Kiírja a bot amit megadsz neki.',
        options: [
            {
                name: 'message',
                description: '---',
                type: 'STRING',
                required: true,
            },
        ],
        default_member_permissions: PermissionFlagsBits.ManageMessages
    },
]

client.on('ready', async () => {
    const appCommands = client.application.commands;
    await appCommands.set(commands);
    console.log(`Bejelentkezve mint: ${client.user.tag}`)
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        if (interaction.commandName === 'ticket') {
            if (interaction.options.getSubcommand() === 'setup') {
                const channel = interaction.options.getChannel('channel');
                const message = interaction.options.getString('message');
                const role = interaction.options.getRole('role');

                if (message.length > 500) return interaction.reply({ content: 'Az üzenet maximum 500 karakter lehet!', ephemeral: true });

                const embed = new MessageEmbed()
                    .setTitle(`${client.user.username} - Ticket Setup`)
                    .setDescription(`A hibajegy rendszer sikeresen elmentve az adatbázisba, a következő értékekkel: \n\nCsatorna: ${channel}\nÜzenet: ${message}\nRang: ${role}`)
                    .setColor(require('./config.json').color)
                    .setTimestamp()
                    .setFooter({ text: 'Made by: sarkydev', iconURL: client.user.displayAvatarURL() })

                await db.set('ticket.channel', channel.id);
                await db.set('ticket.message', message);
                await db.set('ticket.role', role.id);

                await interaction.reply({ embeds: [embed] });
            } else if (interaction.options.getSubcommand() === 'panel') {
                const channelId = await db.get('ticket.channel');
                const channel = interaction.guild.channels.cache.find(channel => channel.id === channelId);

                const message = await db.get('ticket.message');

                const roleId = await db.get('ticket.role');
                const role = interaction.guild.roles.cache.find(role => role.id === roleId);

                if (!channel ?? !role) return interaction.reply({ content: 'A hibajegy rendszer nincs beállítva! Beállítás: **/ticket setup**', ephemeral: true });

                const row = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setStyle('SECONDARY')
                            .setLabel('Létrehozás')
                            .setCustomId('ticket-create')
                    );

                const embed = new MessageEmbed()
                    .setTitle(`${client.user.username} - Ticket Panel`)
                    .setDescription(message)
                    .setColor(require('./config.json').color)
                    .setTimestamp()
                    .setFooter({ text: 'Made by: sarkyyy__', iconURL: client.user.displayAvatarURL() })

                await channel.send({ embeds: [embed], components: [row] })
                await interaction.reply({ content: `A hibajegy panel elküldve a ${channel} csatornába!`, ephemeral: true })
            }
        } else if (interaction.commandName === 'say') {
            const message = interaction.options.getString('message');
            await interaction.reply({ content: `${message}` })
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'ticket-create') {
            let tickets = await db.get('tickets');
            if (!tickets) {
                tickets = [];
            }

            const role = await db.get('ticket.role');

            if (tickets.includes(interaction.user.id)) return interaction.reply({ content: `Már van hibajegyed!`, ephemeral: true });

            await interaction.reply({ content: `Hibajegyed létrehozása folyamatban...`, ephemeral: true });

            const channel = await interaction.guild.channels.create(`hibajegy-${interaction.user.username}`, {
                type: 'GUILD_TEXT',
                topic: interaction.user.id
            });

            await interaction.editReply({ content: `Hibajegyed létrehozva a ${channel} csatornában!`, ephemeral: true });

            const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setStyle('SECONDARY')
                        .setLabel('Törlés')
                        .setCustomId('ticket-delete')
                )

            const embed = new MessageEmbed()
                .setTitle(`${client.user.username} - Ticket System`)
                .setDescription(`Várj türelmesen míg egy ${interaction.guild.roles.cache.get(role)} fel nem figyel rád!`)
                .setColor(require('./config.json').color)
                .setTimestamp()
                .setFooter({ text: 'Made by: sarkyyy__', iconURL: client.user.displayAvatarURL() })

            await tickets.push(interaction.user.id);
            await db.set('tickets', tickets);

            await channel.permissionOverwrites.edit(interaction.guild.id, { VIEW_CHANNEL: false, SEND_MESSAGES: false, ATTACH_FILES: false, EMBED_LINKS: false, READ_MESSAGE_HISTORY: false });
            await channel.permissionOverwrites.edit(interaction.user.id, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ATTACH_FILES: true, EMBED_LINKS: true, READ_MESSAGE_HISTORY: true });
            await channel.permissionOverwrites.edit(role, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ATTACH_FILES: true, EMBED_LINKS: true, READ_MESSAGE_HISTORY: true });

            await channel.send({ embeds: [embed], components: [row] });
        } if (interaction.customId === 'ticket-delete') {
            const userId = interaction.channel.topic;

            let tickets = await db.get('tickets');
            if (!tickets) {
                tickets = [];
            }

            tickets = tickets.filter(user => user !== userId);
            await db.set('tickets', tickets)

            setTimeout(() => {
                interaction.channel.delete()
            }, 5000)

            await interaction.reply({ content: 'A hibajegy **5 másodperc** múlva törlődik.' })
        }
    }
});

client.login(require('./config.json').token)
