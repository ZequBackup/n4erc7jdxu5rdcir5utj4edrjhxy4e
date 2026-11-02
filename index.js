const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const PURPLE = 0x8b5cf6;
const GREEN = 0x35c98a;
const RED = 0xed5565;
const YELLOW = 0xf4c95d;
const TOKEN = process.env.DISCORD_TOKEN;

const CHANNELS = {
  welcome: '1566603290769236208',
  status: '1566603340027273348',
  changelog: '1566603356598960138',
  refund: '1566603484835487794',
  services: '1566603395585015838',
  price: process.env.PRICE_CHANNEL_ID || null,
  supported: '1566603426022826004',
  howToBuy: '1566603440380051486',
  payments: '1566603455991386162',
  delivery: '1566603471266779247',
  reviews: '1566638390122782880',
  tickets: '1566603547775213709',
  suggestions: '1566603563805974578',
  partnerships: '1566603598782009414',
  giveaways: '1566603615051845652',
  modLog: '1566603665291354243',
};

const STAFF_ROLE_IDS = [
  '1566603942110957588',
  '1566604103872684193',
  '1566604601908789288',
  '1566604619176742982',
];
const AUTO_ROLE_ID = '1566605310892843098';
const REVIEWER_ROLE_ID = '1566604736701009921';
const EMOJI = {
  guns: '<:guns_logo:1566613575143788726>',
  noiz: '<:noizlogo:1566613474925215855>',
  crypto: '<:Crypto:1566622483208216576>',
  blik: '<:Blik:1566620779880120321>',
  paypal: '<:Paypal:1566620754718494851>',
};
const GIF_PATH = path.join(__dirname, 'viewzy_logo_eye_discord.gif');
const STATE_PATH = path.join(__dirname, 'viewzy-state.json');

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return {
      staticMessages: parsed.staticMessages || {},
      latestReview: parsed.latestReview || null,
      claimedTickets: parsed.claimedTickets || {},
      giveaways: parsed.giveaways || {},
    };
  } catch {
    return { staticMessages: {}, latestReview: null, claimedTickets: {}, giveaways: {} };
  }
}

const state = loadState();
function saveState() {
  const tempPath = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
  fs.renameSync(tempPath, STATE_PATH);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Publish or update the current service status.')
    .addStringOption(option => option.setName('status').setDescription('Current service status').setRequired(true)
      .addChoices(
        { name: 'Operational', value: 'Operational' },
        { name: 'Delayed', value: 'Delayed' },
        { name: 'Maintenance', value: 'Maintenance' },
      ))
    .addStringOption(option => option.setName('updated').setDescription('UTC time: YYYY-MM-DD HH:mm, or HH:mm').setRequired(true))
    .addStringOption(option => option.setName('details').setDescription('Optional update for customers').setRequired(false)),
  new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Post a Viewzy changelog update.')
    .addStringOption(option => option.setName('date').setDescription('Date of the update').setRequired(true))
    .addStringOption(option => option.setName('update').setDescription('What changed').setRequired(true))
    .addStringOption(option => option.setName('details').setDescription('Optional details').setRequired(false)),
  new SlashCommandBuilder()
    .setName('review')
    .setDescription('Submit a customer review.')
    .addIntegerOption(option => option.setName('views').setDescription('How many views did you buy?').setRequired(true).setMinValue(1))
    .addStringOption(option => option.setName('platform').setDescription('Platform purchased for').setRequired(true)
      .addChoices({ name: 'noiz.bio', value: 'noiz.bio' }, { name: 'guns.lol', value: 'guns.lol' }))
    .addStringOption(option => option.setName('experience').setDescription('Your experience').setRequired(true).setMaxLength(900))
    .addIntegerOption(option => option.setName('rating').setDescription('Rating out of 10').setRequired(true).setMinValue(0).setMaxValue(10)),
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Send a suggestion to the Viewzy team.')
    .addStringOption(option => option.setName('title').setDescription('Title of your suggestion').setRequired(true).setMaxLength(100))
    .addStringOption(option => option.setName('description').setDescription('Describe your suggestion').setRequired(true).setMaxLength(1500)),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a giveaway in the giveaways channel.')
    .addStringOption(option => option.setName('prize').setDescription('What is being given away?').setRequired(true).setMaxLength(200))
    .addStringOption(option => option.setName('duration').setDescription('For example: 30m, 12h, 3d').setRequired(true))
    .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(10))
    .addRoleOption(option => option.setName('required_role').setDescription('Role entrants must have').setRequired(false))
    .addIntegerOption(option => option.setName('server_days').setDescription('Minimum days in this server (0 = none)').setRequired(false).setMinValue(0).setMaxValue(365)),
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Post any missing Viewzy information and ticket panels.'),
].map(command => command.toJSON());

function purpleEmbed(title, description) {
  return new EmbedBuilder().setColor(PURPLE).setTitle(title).setDescription(description).setFooter({ text: 'Viewzy • Official Server' });
}

function isStaff(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator)
    || STAFF_ROLE_IDS.some(roleId => member?.roles?.cache?.has(roleId)));
}

function hasSupportRole(member) {
  return STAFF_ROLE_IDS.some(roleId => member?.roles?.cache?.has(roleId));
}

function hasRole(member, roleId) {
  return Boolean(member?.roles?.cache?.has(roleId));
}

async function getTextChannel(channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && typeof channel.send === 'function' ? channel : null;
}

async function postOnce(key, channelId, embed, components = []) {
  const channel = await getTextChannel(channelId);
  if (!channel) {
    console.warn(`Viewzy setup: can't access text channel ${channelId} (${key}).`);
    return null;
  }
  const savedId = state.staticMessages[key];
  if (savedId) {
    const existing = await channel.messages.fetch(savedId).catch(() => null);
    if (existing) return existing;
  }
  const message = await channel.send({ embeds: [embed], components }).catch(error => {
    console.error(`Couldn't post ${key}:`, error.message);
    return null;
  });
  if (message) {
    state.staticMessages[key] = message.id;
    saveState();
  }
  return message;
}

function ticketPanel() {
  const embed = purpleEmbed('Viewzy Support',
    'Choose the option that best matches your request. A private ticket will open so our team can help you.\n\n'
    + '**Buy Views** — request a package for a supported platform.\n'
    + '**Order Support** — ask about an existing order.\n'
    + '**Report a Problem** — tell us about a delivery or service issue.\n'
    + '**Request a Refund** — submit an order ID and refund reason.\n'
    + '**Other Question** — contact the team about anything else.\n\n'
    + 'Never send your password or verification codes.');
  return {
    embed,
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket:select')
        .setPlaceholder('Select a support option')
        .addOptions(
          { label: 'Buy Views', description: 'Request a new view package', value: 'buy', emoji: '🛒' },
          { label: 'Order Support', description: 'Get help with an existing order', value: 'order', emoji: '📦' },
          { label: 'Report a Problem', description: 'Report a delivery or service issue', value: 'problem', emoji: '⚠️' },
          { label: 'Request a Refund', description: 'Ask us to review a refund request', value: 'refund', emoji: '↩️' },
          { label: 'Other Question', description: 'Ask the Viewzy team something else', value: 'other', emoji: '💬' },
        ),
    )],
  };
}

function ticketModal(type) {
  const modal = new ModalBuilder().setCustomId(`ticket:modal:${type}`).setTitle({
    buy: 'Request a View Package', order: 'Order Support', problem: 'Report a Problem', refund: 'Request a Refund', other: 'Contact Viewzy',
  }[type]);
  const input = (id, label, placeholder, style = TextInputStyle.Short, required = true, maxLength = 500) =>
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder)
      .setStyle(style).setRequired(required).setMaxLength(maxLength));

  if (type === 'buy') {
    modal.addComponents(
      input('platform', 'Platform (noiz.bio or guns.lol)', 'noiz.bio or guns.lol'),
      input('profile', 'Profile name or link', 'Paste your public profile link'),
      input('quantity', 'Number of views', 'For example: 1000'),
    );
  } else if (type === 'order') {
    modal.addComponents(input('order_id', 'Order ID (if available)', 'Your order ID', TextInputStyle.Short, false),
      input('details', 'How can we help?', 'Describe your question', TextInputStyle.Paragraph));
  } else if (type === 'problem') {
    modal.addComponents(input('order_id', 'Order ID (if available)', 'Your order ID', TextInputStyle.Short, false),
      input('details', 'What went wrong?', 'Include any useful details', TextInputStyle.Paragraph));
  } else if (type === 'refund') {
    modal.addComponents(input('order_id', 'Order ID', 'Your order ID'),
      input('reason', 'Reason for your request', 'Briefly explain what happened', TextInputStyle.Paragraph));
  } else {
    modal.addComponents(input('subject', 'Subject', 'What is your question about?'),
      input('details', 'Message', 'Describe how we can help', TextInputStyle.Paragraph));
  }
  return modal;
}

function ticketButtons(channelId, claimedBy = null) {
  const claim = new ButtonBuilder().setCustomId(`ticket:claim:${channelId}`)
    .setLabel(claimedBy ? 'Claimed' : 'Claim Ticket').setStyle(ButtonStyle.Primary).setDisabled(Boolean(claimedBy));
  const close = new ButtonBuilder().setCustomId(`ticket:close:${channelId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger);
  return [new ActionRowBuilder().addComponents(claim, close)];
}

function parseViews(text) {
  const quantity = Number.parseInt(String(text).replace(/[,_\s]/g, ''), 10);
  return Number.isInteger(quantity) && quantity >= 100 && quantity <= 1000000 && quantity % 100 === 0 ? quantity : null;
}

function estimatePrice(platform, views) {
  const normalized = platform.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('guns')) return (views / 100) * 1.05;
  if (normalized.includes('noiz')) return views / 100;
  return null;
}

function formatMoney(amount) {
  return `$${amount.toFixed(2).replace(/\.00$/, '')}`;
}

async function createTicket(interaction, type, details) {
  const guild = interaction.guild;
  const existing = guild.channels.cache.find(channel => channel.type === ChannelType.GuildText
    && channel.topic?.includes(`viewzy-ticket:${interaction.user.id}:`));
  if (existing) {
    await interaction.editReply({ content: `You already have an open ticket: ${existing}` });
    return;
  }

  const typeNames = { buy: 'buy', order: 'order', problem: 'problem', refund: 'refund', other: 'question' };
  const suffix = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'member';
  const roleOverwrites = STAFF_ROLE_IDS.filter(id => guild.roles.cache.has(id)).map(id => ({
    id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
  }));
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ...roleOverwrites,
  ];
  if (guild.members.me) overwrites.push({ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] });

  const supportCategory = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory
    && channel.name.toLowerCase().includes('support'));
  const channel = await guild.channels.create({
    name: `ticket-${typeNames[type]}-${suffix}`.slice(0, 90),
    type: ChannelType.GuildText,
    topic: `viewzy-ticket:${interaction.user.id}:${type}`,
    parent: supportCategory?.id,
    permissionOverwrites: overwrites,
    reason: `Viewzy ${type} ticket opened by ${interaction.user.tag}`,
  });

  const detailLines = Object.entries(details).filter(([, value]) => value)
    .map(([key, value]) => `**${key.replaceAll('_', ' ')}:** ${value}`);
  if (type === 'buy') {
    const views = parseViews(details.quantity);
    const price = views ? estimatePrice(details.platform, views) : null;
    if (price !== null) detailLines.push(`**Estimated price:** ${formatMoney(price)}`);
    else detailLines.push('**Estimated price:** Please confirm the platform and enter views in increments of 100.');
  }
  const ticketEmbed = purpleEmbed(`🎫 ${typeNames[type].replace(/^./, char => char.toUpperCase())} Ticket`,
    `Hello ${interaction.user}, thanks for contacting Viewzy. A team member will assist you here.\n\n${detailLines.join('\n') || 'No details provided.'}`)
    .addFields({ name: 'Ticket owner', value: `${interaction.user}`, inline: true },
      { name: 'Opened', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true })
    .setFooter({ text: `Viewzy • Ticket ID ${channel.id}` });
  await channel.send({ embeds: [ticketEmbed], components: ticketButtons(channel.id) });

  const log = await getTextChannel(CHANNELS.modLog);
  if (log) await log.send({ embeds: [purpleEmbed('Ticket Opened', `**Type:** ${typeNames[type]}\n**User:** ${interaction.user} (${interaction.user.id})\n**Channel:** ${channel}`)] });
  await interaction.editReply({ content: `Your private ticket is ready: ${channel}` });
}

function parseUtcInput(value) {
  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(match[1]), Number(match[2])));
    if (Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    return utcDate;
  }
  match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || hour > 23 || minute > 59) return null;
  return date;
}

function parseDuration(value) {
  const match = value.trim().toLowerCase().match(/^(\d{1,4})\s*(m|min|minutes?|h|hours?|d|days?)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2][0];
  const duration = amount * (unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000);
  return duration >= 60000 && duration <= 30 * 86400000 ? duration : null;
}

function giveawayEmbed(giveaway) {
  const requirementLines = [];
  if (giveaway.roleId) requirementLines.push(`Must have: <@&${giveaway.roleId}>`);
  if (giveaway.serverDays > 0) requirementLines.push(`Must be in the server for at least **${giveaway.serverDays} days**`);
  const endUnix = Math.floor(giveaway.endsAt / 1000);
  return new EmbedBuilder().setColor(PURPLE).setTitle('🎉 Viewzy Giveaway')
    .setDescription(`## ${giveaway.prize}\n\nClick **Enter Giveaway** below to join.\n\n**Winners:** ${giveaway.winners}\n**Created by:** <@${giveaway.createdBy}>\n**Ends:** <t:${endUnix}:F> (<t:${endUnix}:R>)\n**Requirements:** ${requirementLines.join(' • ') || 'None'}`)
    .setFooter({ text: `VIEWZY_GIVEAWAY:${giveaway.id}` });
}

function giveawayButton(giveawayId, disabled = false) {
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway:enter:${giveawayId}`)
    .setLabel('Enter Giveaway').setStyle(ButtonStyle.Success).setDisabled(disabled))];
}

async function finishGiveaway(giveawayId) {
  const giveaway = state.giveaways[giveawayId];
  if (!giveaway) return;
  const channel = await getTextChannel(giveaway.channelId);
  const message = await channel?.messages.fetch(giveaway.messageId).catch(() => null);
  const eligible = [];
  if (channel?.guild) {
    for (const userId of giveaway.entries || []) {
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      if (giveaway.roleId && !member.roles.cache.has(giveaway.roleId)) continue;
      if (giveaway.serverDays > 0 && Date.now() - member.joinedTimestamp < giveaway.serverDays * 86400000) continue;
      eligible.push(userId);
    }
  }
  const winners = [];
  while (eligible.length && winners.length < giveaway.winners) {
    const index = Math.floor(Math.random() * eligible.length);
    winners.push(eligible.splice(index, 1)[0]);
  }
  if (message) {
    const endEmbed = giveawayEmbed(giveaway).setColor(GREEN).setTitle('🎉 Giveaway Ended')
      .setDescription(`## ${giveaway.prize}\n\n**Winners:** ${winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No eligible entries.'}\n**Created by:** <@${giveaway.createdBy}>\n**Ended:** <t:${Math.floor(Date.now() / 1000)}:F>`)
      .setFooter({ text: `VIEWZY_GIVEAWAY_ENDED:${giveaway.id}` });
    await message.edit({ embeds: [endEmbed], components: giveawayButton(giveaway.id, true) }).catch(() => {});
    await channel.send({ content: winners.length ? `Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**.` : `The giveaway for **${giveaway.prize}** ended with no eligible entries.` }).catch(() => {});
  }
  delete state.giveaways[giveawayId];
  saveState();
}

function scheduleGiveaway(giveaway) {
  const delay = Math.max(0, giveaway.endsAt - Date.now());
  const timer = setTimeout(() => {
    if (Date.now() < giveaway.endsAt) scheduleGiveaway(giveaway);
    else finishGiveaway(giveaway.id).catch(console.error);
  }, Math.min(delay, 2147483647));
  timer.unref?.();
}

async function ensureStaticMessages() {
  const posts = [
    ['refund', CHANNELS.refund, purpleEmbed('↩️ Refund Policy',
      'You may request a refund if:\n\n• Your order was not delivered as described.\n• The ordered view count was not reached within 5 days of purchase.\n• You were charged more than once for the same order, or your payment was taken but the order was not created.\n\nFor partially completed orders, refunds cover the **undelivered portion**. If no views were delivered, you may request a full refund.\n\nOpen a support ticket and include your order ID so we can review your request. Refunds may take **1–7 days** to process.')],
    ['services', CHANNELS.services, purpleEmbed('Viewzy Services',
      `Viewzy currently offers views for ${EMOJI.guns} **guns.lol** and ${EMOJI.noiz} **noiz.bio**.\n\nPlease check the delivery details, price, estimated time, and terms before placing an order.\n\nWe will never ask for your password or verification codes.`)],
    ['price', CHANNELS.price, purpleEmbed('Price List',
      `## ${EMOJI.noiz} noiz.bio\n**Rate:** $1 per 100 views\n\n• 100 views — $1\n• 200 views — $2\n• 300 views — $3\n• 400 views — $4\n• 500 views — $5\n• Each additional 100 views — +$1\n\n## ${EMOJI.guns} guns.lol\n**Rate:** $1.05 per 100 views\n\n• 100 views — $1.05\n• 200 views — $2.10\n• 300 views — $3.15\n• 400 views — $4.20\n• 500 views — $5.25\n• Each additional 100 views — +$1.05\n\nTo order, open a ticket and include the platform, profile name or link, and package size. Never share your password or verification codes.`)],
    ['supported', CHANNELS.supported, purpleEmbed('Supported Sites',
      `Currently supported platforms: ${EMOJI.guns} **guns.lol** and ${EMOJI.noiz} **noiz.bio**.\n\nPlease check this channel before ordering. If your platform is not listed, ask us in a ticket.`)],
    ['howToBuy', CHANNELS.howToBuy, purpleEmbed('How to Place an Order',
      `1. Open a ticket in <#${CHANNELS.tickets}>.\n2. Choose a service and confirm that your platform is supported.\n3. Include the platform, profile name or link, and package size in your ticket.\n4. Follow the instructions from the Viewzy team.\n5. Keep your order ID for support. It is required to review refund requests; refunds cannot be issued without it.\n\nWe will never ask for your account password, login codes, or verification codes.`)],
    ['payments', CHANNELS.payments, new EmbedBuilder().setColor(PURPLE).setTitle('Payment Methods')
      .setDescription(`${EMOJI.paypal} **PayPal**\nFriends & Family only\n\n${EMOJI.crypto} **Cryptocurrency**\nBTC • SOL • LTC • ETH\n\n${EMOJI.blik} **BLIK**\nAvailable to customers in Poland.`)
      .setFooter({ text: 'Viewzy • Payment details are confirmed in your private ticket.' })],
    ['delivery', CHANNELS.delivery, purpleEmbed('Estimated Delivery Time',
      '**10 minutes – 1 day**\n\nDelivery may vary depending on the service, platform, and number of views ordered.')],
    ['partnerships', CHANNELS.partnerships, purpleEmbed('✦ Viewzy ✦',
      '## Affordable views for guns.lol, noiz.bio, and more!\n\nWant to give your profile more visibility or aim for a place on the leaderboard? Viewzy offers view packages for guns.lol and noiz.bio, with clear pricing and support from a real person.\n\n### What Viewzy offers\n• Packages in increments of 100 views\n• Fast estimated delivery, depending on the order\n• Private ticket support from start to finish\n• No password or verification code required\n• noiz.bio — $1 per 100 views\n• guns.lol — $1.05 per 100 views\n\n## ✦ Viewzy ✦\n### Get your profile in front of more people\n\nExplore promotion options with clear pricing and terms. Open a ticket to ask the Viewzy team about available options.')],
  ];

  for (const [key, channelId, embed] of posts) {
    let resolvedChannelId = channelId;
    if (key === 'price' && !resolvedChannelId) {
      const priceChannel = client.guilds.cache
        .map(guild => guild.channels.cache.find(channel => channel.type === ChannelType.GuildText
          && channel.name.normalize('NFKD').replace(/[^a-z]/gi, '').toLowerCase().includes('price')))
        .find(Boolean);
      resolvedChannelId = priceChannel?.id;
    }
    if (!resolvedChannelId) {
      console.warn('Viewzy setup: Price channel ID is missing. Set PRICE_CHANNEL_ID or name the channel exactly "Price".');
      continue;
    }
    await postOnce(key, resolvedChannelId, embed);
  }
  const panel = ticketPanel();
  await postOnce('ticketPanel', CHANNELS.tickets, panel.embed, panel.components);
  const reviewsChannel = await getTextChannel(CHANNELS.reviews);
  let latestReviewExists = false;
  if (reviewsChannel && state.latestReview) {
    latestReviewExists = Boolean(await reviewsChannel.messages.fetch(state.latestReview).catch(() => null));
    if (!latestReviewExists) {
      state.latestReview = null;
      saveState();
    }
  }
  if (!latestReviewExists) {
    await postOnce('reviewGuide', CHANNELS.reviews, purpleEmbed('Customer Reviews',
      `Eligible customers can submit a review using **/review**.\n\nYour review should include the package size, platform, experience, and a rating from 0 to 10. Only members with the reviewer role can submit reviews.`));
  }
  await postOnce('suggestionGuide', CHANNELS.suggestions, purpleEmbed('Suggestions',
    'Have an idea to improve Viewzy? Submit it with **/suggest**. Include a clear title and a short description.'));
}

client.once('ready', async () => {
  console.log(`Viewzy is online as ${client.user.tag}`);
  try {
    await client.application.commands.set(commands);
    console.log('Viewzy slash commands registered globally.');
  } catch (error) {
    console.error('Could not register slash commands:', error.message);
  }
  await ensureStaticMessages();
  for (const giveaway of Object.values(state.giveaways)) scheduleGiveaway(giveaway);
});

client.on('guildMemberAdd', async member => {
  try {
    if (member.guild.roles.cache.has(AUTO_ROLE_ID)) {
      await member.roles.add(AUTO_ROLE_ID, 'Default Viewzy member role');
    } else {
      console.warn(`Auto-role ${AUTO_ROLE_ID} was not found in guild ${member.guild.id}.`);
    }
  } catch (error) {
    console.error('Could not assign the default member role:', error.message);
  }

  const channel = await getTextChannel(CHANNELS.welcome);
  if (!channel) return;
  const embed = purpleEmbed(`Welcome to Viewzy, ${member.user.username}!`,
    `You're member **#${member.guild.memberCount}**.\n\nWe're happy you joined Viewzy! Check the server information, supported sites, prices, and order details before opening a ticket.\n\nNever share your password or verification codes.`)
    .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
    .setTimestamp();
  const payload = { content: `Welcome ${member} — enjoy your stay!`, embeds: [embed] };
  if (fs.existsSync(GIF_PATH)) {
    payload.files = [new AttachmentBuilder(GIF_PATH, { name: 'viewzy_logo_eye_discord.gif' })];
    embed.setImage('attachment://viewzy_logo_eye_discord.gif');
  }
  await channel.send(payload).catch(error => console.error('Welcome message failed:', error.message));
});

async function sendModLog(title, description, color = PURPLE) {
  const channel = await getTextChannel(CHANNELS.modLog);
  if (!channel) return;
  await channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()] })
    .catch(error => console.error('Mod log failed:', error.message));
}

async function findAuditEntry(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    return logs.entries.find(entry => entry.target?.id === targetId && Date.now() - entry.createdTimestamp < 15000) || null;
  } catch {
    return null;
  }
}

client.on('guildBanAdd', async ban => {
  const entry = await findAuditEntry(ban.guild, 22, ban.user.id);
  await sendModLog('Member Banned', `**User:** ${ban.user.tag} (${ban.user.id})\n**Moderator:** ${entry?.executor ? `${entry.executor.tag} (${entry.executor.id})` : 'Unknown'}\n**Reason:** ${entry?.reason || 'No reason provided.'}`, RED);
});

client.on('guildBanRemove', async ban => {
  const entry = await findAuditEntry(ban.guild, 23, ban.user.id);
  await sendModLog('Member Unbanned', `**User:** ${ban.user.tag} (${ban.user.id})\n**Moderator:** ${entry?.executor ? `${entry.executor.tag} (${entry.executor.id})` : 'Unknown'}\n**Reason:** ${entry?.reason || 'No reason provided.'}`, GREEN);
});

client.on('guildMemberRemove', async member => {
  const entry = await findAuditEntry(member.guild, 20, member.id);
  if (entry) await sendModLog('Member Kicked', `**User:** ${member.user?.tag || member.id} (${member.id})\n**Moderator:** ${entry.executor ? `${entry.executor.tag} (${entry.executor.id})` : 'Unknown'}\n**Reason:** ${entry.reason || 'No reason provided.'}`, RED);
});

client.on('guildMemberUpdate', async (before, after) => {
  const oldTimeout = before.communicationDisabledUntilTimestamp || 0;
  const newTimeout = after.communicationDisabledUntilTimestamp || 0;
  if (oldTimeout === newTimeout) return;
  const entry = await findAuditEntry(after.guild, 24, after.id);
  await sendModLog(newTimeout > Date.now() ? 'Member Timed Out' : 'Member Timeout Removed',
    `**User:** ${after.user.tag} (${after.id})\n**Moderator:** ${entry?.executor ? `${entry.executor.tag} (${entry.executor.id})` : 'Unknown'}\n**Until:** ${newTimeout > Date.now() ? `<t:${Math.floor(newTimeout / 1000)}:F>` : 'Timeout removed'}\n**Reason:** ${entry?.reason || 'No reason provided.'}`,
    newTimeout > Date.now() ? YELLOW : GREEN);
});

client.on('messageDelete', async message => {
  if (!message.guild || message.author?.bot) return;
  const content = message.content?.trim();
  if (content) await sendModLog('Message Deleted', `**User:** ${message.author.tag} (${message.author.id})\n**Channel:** <#${message.channel.id}>\n**Content:** ${content.slice(0, 1200)}`, YELLOW);
});

client.on('messageUpdate', async (before, after) => {
  if (!after.guild || after.author?.bot || before.content === after.content || !before.content || !after.content) return;
  await sendModLog('Message Edited', `**User:** ${after.author.tag} (${after.author.id})\n**Channel:** <#${after.channel.id}>\n**Before:** ${before.content.slice(0, 700)}\n**After:** ${after.content.slice(0, 700)}`, YELLOW);
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (message.channel.id !== CHANNELS.reviews && message.channel.id !== CHANNELS.suggestions) return;
  await message.delete().catch(() => {});
  const note = message.channel.id === CHANNELS.reviews
    ? 'Reviews channel is command-only. Use **/review** (reviewer role required).'
    : 'Suggestions channel is command-only. Use **/suggest** to submit an idea.';
  await message.author.send(note).catch(() => {});
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      if (['status', 'changelog', 'giveaway', 'setup'].includes(commandName) && !isStaff(interaction.member)) {
        await interaction.reply({ content: 'This command is available to the Viewzy team only.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (commandName === 'setup') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await ensureStaticMessages();
        await interaction.editReply('Setup complete. Existing Viewzy posts were kept; missing posts and panels were sent.');
        return;
      }

      if (commandName === 'status') {
        const status = interaction.options.getString('status', true);
        const updatedInput = interaction.options.getString('updated', true);
        const date = parseUtcInput(updatedInput);
        if (!date) {
          await interaction.reply({ content: 'Use UTC format `YYYY-MM-DD HH:mm` or `HH:mm` (for today). Example: `2026-11-02 14:22`.', flags: MessageFlags.Ephemeral });
          return;
        }
        const unix = Math.floor(date.getTime() / 1000);
        const details = interaction.options.getString('details');
        const color = status === 'Operational' ? GREEN : status === 'Delayed' ? YELLOW : RED;
        const embed = new EmbedBuilder().setColor(color).setTitle('Viewzy Service Status')
          .addFields({ name: 'Current status', value: `**${status}**`, inline: true },
            { name: 'Updated', value: `<t:${unix}:F> (<t:${unix}:R>)` });
        if (details?.trim()) embed.addFields({ name: 'Details', value: details.trim().slice(0, 1024) });
        embed.setFooter({ text: 'Viewzy • Service Status' });
        const channel = await getTextChannel(CHANNELS.status);
        if (!channel) throw new Error('I cannot access the Service Status channel.');
        const saved = state.staticMessages.currentStatus ? await channel.messages.fetch(state.staticMessages.currentStatus).catch(() => null) : null;
        const posted = saved ? await saved.edit({ embeds: [embed] }) : await channel.send({ embeds: [embed] });
        state.staticMessages.currentStatus = posted.id;
        saveState();
        await interaction.reply({ content: `Service status updated in ${channel}. Discord will display the time in each member's local timezone.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (commandName === 'changelog') {
        const channel = await getTextChannel(CHANNELS.changelog);
        if (!channel) throw new Error('I cannot access the Changelog channel.');
        const embed = purpleEmbed('Viewzy Changelog', `**Date:** ${interaction.options.getString('date', true)}\n**Update:** ${interaction.options.getString('update', true)}\n${interaction.options.getString('details')?.trim() ? `\n**Details:** ${interaction.options.getString('details').trim()}` : ''}`)
          .setTimestamp();
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: `Changelog posted in ${channel}.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (commandName === 'review') {
        if (!hasRole(interaction.member, REVIEWER_ROLE_ID)) {
          await interaction.reply({ content: 'Only members with the Viewzy Reviewer role can submit a review.', flags: MessageFlags.Ephemeral });
          return;
        }
        const channel = await getTextChannel(CHANNELS.reviews);
        if (!channel) throw new Error('I cannot access the Reviews channel.');
        const old = state.latestReview ? await channel.messages.fetch(state.latestReview).catch(() => null) : null;
        if (old) await old.delete().catch(() => {});
        const guideId = state.staticMessages.reviewGuide;
        if (guideId) {
          const guide = await channel.messages.fetch(guideId).catch(() => null);
          if (guide) await guide.delete().catch(() => {});
        }
        const platform = interaction.options.getString('platform', true);
        const platformEmoji = platform === 'guns.lol' ? EMOJI.guns : EMOJI.noiz;
        const embed = purpleEmbed('Latest Customer Review', `**Views purchased:** ${interaction.options.getInteger('views', true).toLocaleString()}\n**Platform:** ${platformEmoji} ${platform}\n**Experience:** ${interaction.options.getString('experience', true)}\n**Rating:** ${'★'.repeat(interaction.options.getInteger('rating', true))}${'☆'.repeat(10 - interaction.options.getInteger('rating', true))} (${interaction.options.getInteger('rating', true)}/10)`)
          .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp()
          .setFooter({ text: 'Viewzy • Latest customer review' });
        const posted = await channel.send({ embeds: [embed] });
        state.latestReview = posted.id;
        delete state.staticMessages.reviewGuide;
        saveState();
        await interaction.reply({ content: 'Your review has been published. It is now the latest review in the channel.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (commandName === 'suggest') {
        const channel = await getTextChannel(CHANNELS.suggestions);
        if (!channel) throw new Error('I cannot access the Suggestions channel.');
        const embed = purpleEmbed(`Suggestion: ${interaction.options.getString('title', true)}`, interaction.options.getString('description', true))
          .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Thank you — your suggestion has been sent to the Viewzy team.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (commandName === 'giveaway') {
        const duration = parseDuration(interaction.options.getString('duration', true));
        if (!duration) {
          await interaction.reply({ content: 'Enter a duration such as `30m`, `12h`, or `3d` (maximum 30 days).', flags: MessageFlags.Ephemeral });
          return;
        }
        const channel = await getTextChannel(CHANNELS.giveaways);
        if (!channel) throw new Error('I cannot access the Giveaways channel.');
        const giveaway = {
          id: `${Date.now()}-${interaction.user.id}`,
          prize: interaction.options.getString('prize', true),
          winners: interaction.options.getInteger('winners', true),
          roleId: interaction.options.getRole('required_role')?.id || null,
          serverDays: interaction.options.getInteger('server_days') || 0,
          createdBy: interaction.user.id,
          endsAt: Date.now() + duration,
          channelId: channel.id,
          messageId: null,
          entries: [],
        };
        const message = await channel.send({ embeds: [giveawayEmbed(giveaway)], components: giveawayButton(giveaway.id) });
        giveaway.messageId = message.id;
        state.giveaways[giveaway.id] = giveaway;
        saveState();
        scheduleGiveaway(giveaway);
        await interaction.reply({ content: `Giveaway created in ${channel}.`, flags: MessageFlags.Ephemeral });
        return;
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:select') {
      await interaction.showModal(ticketModal(interaction.values[0]));
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket:modal:')) {
      const type = interaction.customId.split(':')[2];
      const fields = Object.fromEntries(interaction.fields.fields.map(field => [field.customId, field.value.trim()]));
      if (type === 'buy') {
        const views = parseViews(fields.quantity);
        if (!views) {
          await interaction.reply({ content: 'Please enter a number of views in increments of 100 (for example, 1000).', flags: MessageFlags.Ephemeral });
          return;
        }
        const platform = fields.platform.toLowerCase();
        if (!platform.includes('guns') && !platform.includes('noiz')) {
          await interaction.reply({ content: 'Currently supported platforms are noiz.bio and guns.lol. Please open a new ticket and enter one of those.', flags: MessageFlags.Ephemeral });
          return;
        }
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await createTicket(interaction, type, fields);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ticket:claim:')) {
      if (!hasSupportRole(interaction.member)) {
        await interaction.reply({ content: 'Only the Viewzy team can claim tickets.', flags: MessageFlags.Ephemeral });
        return;
      }
      const channelId = interaction.customId.split(':')[2];
      state.claimedTickets[channelId] = interaction.user.id;
      saveState();
      await interaction.update({ components: ticketButtons(channelId, interaction.user.id) });
      await interaction.channel.send({ embeds: [purpleEmbed('Ticket Claimed', `${interaction.user} is now handling this ticket.`)] });
      await sendModLog('Ticket Claimed', `**Ticket:** <#${channelId}>\n**Claimed by:** ${interaction.user} (${interaction.user.id})`);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ticket:close:')) {
      if (!hasSupportRole(interaction.member)) {
        await interaction.reply({ content: 'Only the Viewzy team can close tickets.', flags: MessageFlags.Ephemeral });
        return;
      }
      const channelId = interaction.customId.split(':')[2];
      const modal = new ModalBuilder().setCustomId(`ticket:closeModal:${channelId}`).setTitle('Close Ticket')
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Closure reason')
          .setPlaceholder('Briefly explain why this ticket is being closed').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket:closeModal:')) {
      if (!hasSupportRole(interaction.member)) {
        await interaction.reply({ content: 'Only the Viewzy team can close tickets.', flags: MessageFlags.Ephemeral });
        return;
      }
      const channelId = interaction.customId.split(':')[2];
      const ticketChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      const topic = ticketChannel?.topic || '';
      const [, ownerId, ticketType] = topic.match(/viewzy-ticket:(\d+):([^;]+)/) || [];
      const reason = interaction.fields.getTextInputValue('reason').trim();
      const claimer = state.claimedTickets[channelId];
      await sendModLog('Ticket Closed', `**Type:** ${ticketType || 'unknown'}\n**Channel:** ${ticketChannel ? `<#${channelId}>` : channelId}\n**Owner:** ${ownerId ? `<@${ownerId}> (${ownerId})` : 'Unknown'}\n**Closed by:** ${interaction.user} (${interaction.user.id})\n**Claimed by:** ${claimer ? `<@${claimer}>` : 'Unclaimed'}\n**Reason:** ${reason}`, RED);
      delete state.claimedTickets[channelId];
      saveState();
      await interaction.reply({ content: 'Ticket closed. The closure reason has been recorded in Mod-Log.', flags: MessageFlags.Ephemeral });
      if (ticketChannel) {
        await ticketChannel.send({ embeds: [new EmbedBuilder().setColor(RED).setTitle('Ticket Closed').setDescription(`Closed by ${interaction.user}.\n**Reason:** ${reason}`).setTimestamp()] }).catch(() => {});
        setTimeout(() => ticketChannel.delete(`Closed by ${interaction.user.tag}: ${reason}`).catch(() => {}), 7000).unref?.();
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('giveaway:enter:')) {
      const id = interaction.customId.slice('giveaway:enter:'.length);
      const giveaway = state.giveaways[id];
      if (!giveaway) {
        await interaction.reply({ content: 'This giveaway has ended or is no longer active.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (giveaway.roleId && !interaction.member.roles.cache.has(giveaway.roleId)) {
        await interaction.reply({ content: `You need the <@&${giveaway.roleId}> role to enter.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (giveaway.serverDays > 0 && Date.now() - interaction.member.joinedTimestamp < giveaway.serverDays * 86400000) {
        await interaction.reply({ content: `You must have been in this server for at least ${giveaway.serverDays} days to enter.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (giveaway.entries.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You are already entered in this giveaway.', flags: MessageFlags.Ephemeral });
        return;
      }
      giveaway.entries.push(interaction.user.id);
      saveState();
      await interaction.reply({ content: 'You are entered in the giveaway. Good luck!', flags: MessageFlags.Ephemeral });
      return;
    }
  } catch (error) {
    console.error('Interaction error:', error);
    const message = 'Something went wrong while processing that request. Please try again or contact the Viewzy team.';
    if (interaction.deferred) await interaction.editReply({ content: message }).catch(() => {});
    else if (interaction.replied) await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable. Add your bot token in Wispbyte → Startup → Environment Variables.');
  process.exit(1);
}

client.login(TOKEN);
