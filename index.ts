'use strict'

const axios = require('axios')
const Jimp = require('jimp')
const fs = require('fs').promises
const TelegramBot = require('node-telegram-bot-api')
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {polling: true})
const {Server} = require('socket.io')
const emojiMap = require('unicode-emoji-json/data-by-emoji.json')

let fsh
async function getDbFileHandle() {
  try {
    fsh = await fs.open('./bump-db.json', 'r+')
  } catch (e) {
    console.log('error while opening file handle', e)
    fsh = await fs.open('./bump-db.json', 'w+')
  }
  return fsh
}

const dbDefault = {
  seen: {},
  sent: {}
}
async function loadDb() {
  let data = ''
  try {
    data = (await fsh.readFile()).toString()
  } catch (e) {
    console.log('failed reading db', e)
    return dbDefault
  }
  if (data) {
    return JSON.parse(data)
  } else {
    console.log('zcv')
    return dbDefault
  }
}

async function saveDb(db) {
  try {
    console.log('writing db')
    await fsh.write(JSON.stringify(db), 0)
  } catch (e) {
    console.log('failed to write db', e)
  }
}

// number of stickers per set
const SET_SIZE = 100

// uploading is dominated by network requests, so we can push this up to
// saturate the cpu with image processing
const PARALLEL_UPLOADERS = 2


const imageRegex = /jpg-large$|png-large$|\.png$|\.jpg$|\.jpeg$/i

function sleep(n) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, n)
  })
}

function getEmoji() {
  return '🍆'
}

function getStickerSetName({botInfo, setIdx}) {
  return `shithouse_scoop_${setIdx}_by_${botInfo.username}`
}

async function uploader(botInfo, bumps, db) {
  const {seen, sent} = db
  while(bumps.length) {
    const bump = bumps.pop()
    const i = bumps.length
    if (seen[bump.name]) continue
    console.log('uploading ' + bump.name)

    // compute sticker set name
    const setIdx = (i / SET_SIZE) | 0
    const setName = getStickerSetName({botInfo, setIdx})

    // compute image buffer to send
    let im
    try {
      im = await Jimp.read(`https://${bump.name}.shithouse.tv/${bump.image}`)
    } catch (e) {
      console.log('error fetching bump', e)
      seen[bump.name] = true
      await saveDb(db)
      continue
    }
    im.scaleToFit(512, 512)
    const toSend = await im.getBufferAsync('image/png')
    console.log('processing', i, setIdx, bump)

    try {
      await bot.createNewStickerSet(
        process.env.TELEGRAM_USER_ID,
        setName,
        `poop scoop ${setIdx}`,
        toSend,
        getEmoji()
      )
    } catch (e) {
      if (e.response.body.description !== 'Bad Request: sticker set name is already occupied') {
        console.log('error making set:', e)
      } else {
        console.log('ok')
      }
    }

    seen[bump.name] = true
    try {
      await bot.addStickerToSet(
        process.env.TELEGRAM_USER_ID,
        setName,
        toSend,
        getEmoji()
      )
      await saveDb(db)
    } catch (e) {
      console.log(e)
      await saveDb(db)
      continue
    }
    if (!sent[setIdx]) {
      const stickerSet = await bot.getStickerSet(setName)
      await bot.sendSticker(
        process.env.TELEGRAM_USER_ID,
        stickerSet.stickers[0].file_id
      )
      sent[setIdx] = true
      await saveDb(db)
    }
    await sleep(100)
  }
}

function generateUploadBumps(numWorkers) {
  return async function uploadBumps(botInfo, db, bumps) {
    for (let i = 0; i < numWorkers; ++i) {
      uploader(botInfo, bumps, db)
    }
  }
}

// link scraper
const httpPattern = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi

async function startLinkScraper(botInfo, db) {
  if (db.lastMessageIdSeen == null) {
    db.lastMessageIdSeen = 0
    await saveDb(db)
  }

  bot.onText(httpPattern, async (msg, match) => {
    if (msg.message_id > db.lastMessageIdSeen) {
      db.lastMessageIdSeen = msg.message_id
      await saveDb(db)
      const person = msg.from.username || msg.from.first_name
      const payload = {
        submission_salt: process.env.IFF_SUBMISSION_SALT,
        url: match[1],
        person,
        title: msg.text
      }
      try {
        await axios.post('https://infoforcefeed.shithouse.tv/submit', payload)
      } catch (e) {
        console.log('failure in shipping', {
          payload,
          e
        })
      }
    }
  })
}

async function getBumps() {
  try {
    const bumpRequest = axios.get('https://api.shithouse.tv')
    return (await bumpRequest).data.filter(b => b.image && imageRegex.test(b.image)).reverse()
  } catch (e) {
    console.error('failed in getting bumps')
    return []
  }
}

async function getSet(setName) {
  try {
    return await bot.getStickerSet(setName)
  } catch (e) {
    return null
  }
}

async function cleanBumps(arg) {
  if (!process.env.CLEAN_BUMPS) return arg
  console.log('cleanin bumps')
  const [{botInfo}] = arg
  let setIdx = 0
  let currSet
  while (currSet = await getSet(getStickerSetName({botInfo, setIdx}))) {
    for (let s of currSet.stickers) {
        console.log('clearing', s.file_id)
      await bot.deleteStickerFromSet(s.file_id)
    }
    ++setIdx
  }
  await fs.unlink('./bump-db.json')
  arg[1] = dbDefault
  return arg
}

async function getMetadata() {
  return {
    botInfo: await bot.getMe()
  }
}

function registerCommands(commands) {
  bot.setMyCommands(commands.map((command) => ({
    command: `/${command.command}`,
    description: command.description
  })))

  commands.forEach((command) => {
    command.parameters = command.parameters || []
    const cmdRegex = `^/${command.command}(?:@\\w+)?${
      command.parameters.map((param) => `(?:\\s+(${param})`).join('')
    }${command.parameters.map(() => ')?').join('')}$`
    console.log(cmdRegex)
    bot.onText(
      new RegExp(cmdRegex),
      (msg, [, ...params]) => command.action(msg, ...params)
    )
  })
}

bot.onText(
  /(?<lift>[a-zA-Z0-9\s]+): (?<sets>[0-9]+)x(?<reps>[0-9]+)@(?<weight>[0-9]+)/,
  async (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message
    const chatId = msg.chat.id;
    const payload = {
      nickname: msg.from.first_name,
      sets: Number(match.groups.sets),
      weight: Number(match.groups.weight),
      reps: Number(match.groups.reps),
      lift: match.groups.lift
    };
    console.log('ayloa', payload);
    try {
      const hello = await axios.post('https://wheypi.shithouse.tv/api/lifts',
        payload,
        {headers: {'Authorization': `${process.env.LIFT_TOKEN}`}}
        );
        console.log('res', hello.data)
      if(hello) {
        const response = `YA GONNA GET SWOLE DOING ${match.groups.lift.toUpperCase()}?\r\nSETS: ${match.groups.sets}\r\nREPS: ${match.groups.reps}\r\nWEIGHT: ${match.groups.weight}`;
        bot.sendMessage(chatId, response);
      }
    } catch(error) {
      // console.log('Lift post error',error)
      console.log('message:', error.message)
      console.log('code:', error.code);
      console.log('request:', error.request);
      console.log('isAxiosError', error.isAxiosError);

      // console.log('response', error.response);
      if(error.response){
      console.log('data', error.response.data);
      console.log('status', error.response.status);
      // console.log('headers', error.response.headers);
      bot.sendMessage(chatId, 'FUCK YOU WEAKLING')
      }
    }
  }
);

// TODO: fix "lift" regex, spit errors on failed posts, fix async bot msging
async function myLifts(msg) {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message
  const chatId = msg.chat.id;
  const nickname = msg.from.first_name;
  try {
    const hello = await axios.get(`https://wheypi.shithouse.tv/api/lifts/${nickname}`);

    if(hello.data.data.length > 0) {
      bot.sendMessage(chatId, `HERE'S YOUR WORKOUT SCRUB:`)
      hello.data.data.forEach(lift => {
        bot.sendMessage(chatId, `${lift.lift}\r\nSETS ${lift.sets}\r\nREPS ${lift.reps}\r\nWEIGHT ${lift.weight}`);
      });
      bot.sendMessage(chatId, 'DO MORE REPS TODAY, ARE YOU FUCKING TIRED YET?')
    } else {
      bot.sendMessage(chatId, `WHAT DO YOU MEAN YOU DON'T HAVE A ROUTINE YET?`)
    }

  } catch(error) {
    // console.log('Lift post error',error)
    console.log('message:', error.message)
    console.log('code:', error.code);
    console.log('request:', error.request);
    console.log('isAxiosError', error.isAxiosError);

    // console.log('response', error.response);
    if(error.response){
    console.log('data', error.response.data);
    console.log('status', error.response.status);
    // console.log('headers', error.response.headers);
    bot.sendMessage(chatId, 'FUCK YOU WEAKLING')
    }
  }
}

const punk = [
  'https://www.youtube.com/watch?v=hrkuo0y8gMU',
  'https://www.youtube.com/watch?v=aa3Afg3fzAQ',
  'https://www.youtube.com/watch?v=iVuB1ZASrGw',
  'https://www.youtube.com/watch?v=3NZGbD236fw',
  'https://www.youtube.com/watch?v=--p34RKclbA',
  'https://www.youtube.com/watch?v=gLbfm-gcoGs',
  'https://www.youtube.com/watch?v=mesnQSJmSHA',
]

async function genPunk(msg) {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, punk[punk.length * Math.random() | 0])
}

const pizzas = [
  {
    text: 'BASSBOOSTED',
    url: 'https://www.youtube.com/watch?v=Q6jJQWc2hBY'
  },
  {
    text: 'REGULAR',
    url: 'https://www.youtube.com/watch?v=czTksCF6X8Y'
  },
  {
    text: 'EXTENDED',
    url: 'https://soundcloud.com/dullstaples/the-spiderman-2-pizza-theme-but-its-extended-for-over-4-minutes'
  },
  {
    text: 'OTAMATONE',
    url: 'https://www.youtube.com/watch?v=fAdFL_6ii4U'
  },
  {
    text: 'PIZZATIME',
    url: 'https://www.youtube.com/watch?v=lpvT-Fciu-4'
  },
  {
    text: 'ONE HOUR',
    url: 'https://www.youtube.com/watch?v=gUqH6Weyr2M'
  },
  {
    text: 'METAL',
    url: 'https://www.youtube.com/watch?v=w8n2-l3bCn0'
  },
  {
    text: 'BASSBOOSTED',
    url: 'https://www.youtube.com/watch?v=3NZGbD236fw'
  }
]

function getPizza(pizzas) {
  return [pizzas[Math.floor(Math.random() * pizzas.length)]]
}

bot.onText(/(spiderman|spider-man|spider man)/gi, function onEditableText(msg) {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        getPizza(pizzas)
      ]
    }
  };
  bot.sendMessage(msg.chat.id, 'PIZZA TIME', opts);
});

// AI conversations.
(async () => {
  const {ShitBot} = await import('./src/chats.mjs')
  const {BeckyBot} = await import('./src/becky.mjs')
  const io = new Server();
  const shitBot = new ShitBot({bot, chatGptKey: process.env.OPENAI_API_KEY!, io, emojiMap})
  const beckyBot = new BeckyBot({bot, io})

  bot.onText(/^(?:@([^\s]+)\s)?((?:.|\n)+)$/m, async function(msg, [, username, capturedMessage]) {
    // Don't respond to commands. Too lazy to fix the onText regex.
    if (capturedMessage[0] === '/') return;

    await shitBot.process(msg, username, capturedMessage)
  })

  bot.on('sticker', async (msg) => {
    await shitBot.processSticker(msg)
  })

  bot.onText(/^\/setai(?:@\w+)?$/, async function(msg) {
    bot.sendMessage(msg.chat.id, 'Select AI mode:', {
      reply_markup: {
        one_time_keyboard: true,
        inline_keyboard: [[
          {text: 'openai'},
          {text: 'chat-gpt'}
        ]]
      }
    })
  })

  async function setAI(msg, backend, model) {
    const [ai, chosenModel] = shitBot.setAiBackend(backend, model)
    await bot.sendMessage(msg.chat.id, `AI backend set to ${ai} ${chosenModel}.`)
  }

  async function generateImage(msg, prompt) {
    await shitBot.processImage(msg, prompt);
  }

  async function becky(msg, command) {
    beckyBot.process(msg, command);
  }

  registerCommands([{
    command: 'mylifts',
    description: 'LIFT MORE',
    action: myLifts
  }, {
    command: 'setai',
    description: 'Change AI backend for conversations.',
    parameters: ['[\\w-]+', '[\\w-]+'],
    action: setAI
  }, {
    command: 'genimage',
    description: 'Make an image from a prompt.',
    parameters: ['.+'],
    action: generateImage
  }, {
    command: 'punk',
    description: 'MAKE NOISE',
    action: genPunk
  }, {
    command: 'becky',
    description: `What's the weather?`,
    parameters: ['.*'],
    action: becky
  }])
  io.listen(6969)
})()

bot.onText(/.*market.*/gi, function onEditableText(msg) {
  const m = Math.floor(Math.random() * 3);
  if (m <= 1) {
    bot.sendMessage(msg.chat.id, `Easy, chief. Any rate the market offers is, by definition, fair.`);
  }
});

bot.onText(/.*#8ball*/gi, function onEditableText(msg) {
  const answers = ["It is certain.", "It is decidedly so.", "Without a doubt.", "Yes, definitely.", "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.", "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.", "Don't count on it.", "My reply is no.", "My sources say no.", "Outlook not so good.", "Very doubtful."];
  const answer = answers[Math.floor(Math.random() * answers.length)];
  bot.sendMessage(msg.chat.id, answer);
});

bot.onText(/.*(authoritarian|libertarian).*/gi, function onEditableText(msg) {
  const m = Math.floor(Math.random() * 3);
  if (m <= 1) {
    bot.sendMessage(msg.chat.id, `Idealist that you are, you don't understand that all revolutions are authoritarian. A state will always arise as a byproduct of class society as one class imposes dictatorship on the other. Will you fight? Or will you aid reaction like a dog?`);
  }
});

bot.onText(/.*gorilla.*/gi, function onEditableText(msg) {
  const body = `What the fuck did you just fucking say about me, you little bitch? I'll have you know I graduated top of my class in the Navy Seals, and I've been involved in numerous secret raids on Al-Quaeda, and I have over 300 confirmed kills. I am trained in gorilla warfare and I'm the top sniper in the entire US armed forces. You are nothing to me but just another target. I will wipe you the fuck out with precision the likes of which has never been seen before on this Earth, mark my fucking words. You think you can get away with saying that shit to me over the Internet? Think again, fucker. As we speak I am contacting my secret network of spies across the USA and your IP is being traced right now so you better prepare for the storm, maggot. The storm that wipes out the pathetic little thing you call your life. You're fucking dead, kid. I can be anywhere, anytime, and I can kill you in over seven hundred ways, and that's just with my bare hands. Not only am I extensively trained in unarmed combat, but I have access to the entire arsenal of the United States Marine Corps and I will use it to its full extent to wipe your miserable ass off the face of the continent, you little shit. If only you could have known what unholy retribution your little "clever" comment was about to bring down upon you, maybe you would have held your fucking tongue. But you couldn't, you didn't, and now you're paying the price, you goddamn idiot. I will shit fury all over you and you will drown in it. You're fucking dead, kiddo.`;
  const m = Math.floor(Math.random() * 6);
  if (m <= 1) {
    bot.sendMessage(msg.chat.id, body);
  }
});

bot.onText(/.*linux.*/gi, function onEditableText(msg) {
  const body = `I'd just like to interject for a moment. What you're referring to as Linux, is in fact, GNU/Linux, or as I've recently taken to calling it, GNU plus Linux. Linux is not an operating system unto itself, but rather another free component of a fully functioning GNU system made useful by the GNU corelibs, shell utilities and vital system components comprising a full OS as defined by POSIX.`
  const msg1 = `Many computer users run a modified version of the GNU system every day, without realizing it. Through a peculiar turn of events, the version of GNU which is widely used today is often called "Linux", and many of its users are not aware that it is basically the GNU system, developed by the GNU Project.`
  const msg2 = `There really is a Linux, and these people are using it, but it is just a part of the system they use. Linux is the kernel: the program in the system that allocates the machine's resources to the other programs that you run. The kernel is an essential part of an operating system, but useless by itself; it can only function in the context of a complete operating system. Linux is normally used in combination with the GNU operating system: the whole system is basically GNU with Linux added, or GNU/Linux. All the so-called "Linux" distributions are really distributions of GNU/Linux.`

  const m = Math.floor(Math.random() * 10);
  if (m <= 1) {
    // Loops are forbidden here
    bot.sendMessage(msg.chat.id, body);
    bot.sendMessage(msg.chat.id, msg1);
    bot.sendMessage(msg.chat.id, msg2);
  }
});

bot.onText(/.*clear.*keyboard.*/gi, (msg) => {
  const opts = {
    reply_to_message_id: msg.message_id,
    reply_markup: JSON.stringify({
      remove_keyboard: true
    })
  };
  bot.sendMessage(msg.chat.id, 'ok', opts);
})

// Keyboard replacement meme
bot.onText(/fmuf2/, (msg) => {
  const opts = {
    reply_to_message_id: msg.message_id,
    reply_markup: JSON.stringify({
      one_time_keyboard: true,
      keyboard: [
        ['AAAAAAAAAAAAAAA'],
        ['AAAAAAAAAAAAAAAAAAAAAAAAAAA'],
        ['AAAAAAAAAAAAAAAAAAAAAAA'],
        ['AAAAAAAAA'],
        ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']
      ]
    })
  };
  bot.sendMessage(msg.chat.id, 'AAAAAAAAAAAA', opts);
});

// Inline keboard example
bot.onText(/fmuf/, function onEditableText(msg) {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '1',
            callback_data: 'ASDF'
          },
          {
            text: '2',
            callback_data: '2'
          },
          {
            text: '3',
            callback_data: '3'
          },
          {
            text: '4',
            callback_data: '4'
          },
          {
            text: '5',
            callback_data: '5'
          },
          {
            text: 'ASDF',
            callback_data: 'ALKSDJFKLS'
          },
        ]
      ]
    }
  };
  bot.sendMessage(msg.chat.id, 'Original Text', opts);
});

let bumpLoad = 0;
let bumpMap = {};
bot.onText(/^\\(\S+)$/, async (msg, [, bump]) => {
  if ((Date.now() - bumpLoad) > (24 * 60 * 60 * 1000)) {
    const bumps = await getBumps();
    bumpMap = {};
    for (const {name, image} of bumps) bumpMap[name] = image;
    bumpLoad = Date.now();
  }

  if (bump in bumpMap) {
    await bot.sendPhoto(
      msg.chat.id,
      `https://${bump}.shithouse.tv/${bumpMap[bump]}`
    );
  }
})

// Handle callback queries
bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const opts = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
  };
  let text;

  switch(action) {
    case '1':
      text = '1';
      break;
    case '2':
      text = '2';
      break;
    case '3':
      text = '3';
      break;
    case '4':
      text = '4';
      break;
    case '5':
      text = '5';
      break;
  }

  bot.editMessageText(`Selected: ${text}`, opts);
});



/*
Command/Bot Ideas
  make a chat with a bot that auto-keyboards to various "AAAAAAAAAA" messages and bans everyone who doesn't use them

  useful refrence https://github.com/yagop/node-telegram-bot-api/blob/release/examples/polling.js
*/


Promise.all([
  getMetadata(),
  getDbFileHandle().then(loadDb),
])
  .then(cleanBumps)
  .then(async function([{botInfo}, db]) {
    console.log("starting scraping")
    startLinkScraper(botInfo, db)
    while (true) {
      const bumps = await getBumps()
      await generateUploadBumps(PARALLEL_UPLOADERS)(botInfo, db, bumps)
      await sleep(4*60*60*1000)
    }
  })
//console.log(process.env)
