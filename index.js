require("dotenv").config();
const { VoiceConnection } = require("eris");
const Eris = require("eris");
//const ytdl = require('ytdl-core');
const exec = require('child_process').exec;

const fs = require('fs');

const MusicRepository = require("./MusicRepository");
const { match } = require("assert");
const { debug } = require("console");
const { env } = require("process");

const knex = require('knex')({
    client: process.env.DB_CLIENT,
    connection: {
        host : process.env.DB_HOST,
        user : process.env.DB_USER,
        password : process.env.DB_PASSWORD,
        database : process.env.DB_DATABASE
    }
});

const MusicQueue = {
    urls: [],
    playing: false,
    connection: null,
};


(async () => {

    const music = new MusicRepository(knex);

    
    play = async function (connection, url) {

        console.log(`checking database file for: "${url}".. `);
        let musicFileName = await music.getMusicFilenameFromUrl(url);

        let excists = false;
        if (musicFileName.length < 0) {
            console.log('looking for filename' + musicFileName);
            try {
                fs.accessSync(musicFileName);
                exists = true;
            }
            catch(err) { console.log(err); }
        }
        else {
            console.log('song not in database..')
        }
        
        if (excists) {
            console.log('file found, playing: ' + url)


            if(!connection.playing && !connection.piper.encoding) {
                connection.play(musicFileName)
                connection.updateVoiceState(false, true);
            }
        }
        else {
            console.log('downloading and adding song to db: ' + url);
            
            const getMusicInfo = (url) => {
                return new Promise((resolve, reject) => {
                    exec('youtube-dl.exe ' + url + ' -o music/%(title)s-%(id)s.%(ext)s --print-json', function( error, stdout, stderr) {
                        if ( error != null ) {
                            console.log(stderr);
                            reject([error, stderr])
                            return;
                        }
                        
                        //console.log(stdout)
                        let data = JSON.parse(stdout);
                        resolve(data);
                    });
                });
            };

            let data = await getMusicInfo(url);
            console.log(data);

            if(!connection.playing && !connection.piper.encoding) {
                connection.play(data._filename)
            }

            music.createSong(url, data.title, data._filename, data.artist, data.album, data.track, data.thumbnail);

            //save filename/ title and id in db for faster searching?

        }
    };

    playQueue = async function (connection, urls) {

        let url = urls.shift();
        urls.push(url);

        MusicQueue.urls = urls;

        connection.once('end', () => {
            console.log('finished playing');
            console.log(urls);
            if (urls.length > 0) {
                playQueue(connection, urls);
            }
            else {
                console.log('end of queue');
            }
        });

        play(connection, url)
    };

    //result = knex.select().table('tag');

    var bot = new Eris(process.env.USALIA_TOKEN);
    // Replace TOKEN with your bot account's token

    bot.on("ready", () => { // When the bot is ready
        console.log("Ready!"); // Log "Ready!"
        join_voice();
    });

    join_voice = function() {
        bot.joinVoiceChannel(process.env.GUILD_RADIO_ID).catch((err) => { // Join the user's voice channel
            console.log(err); // Log the error
        }).then(async (connection) => {
            connection.updateVoiceState(false, true);
            //connection.play("./test.m4a");
            //connection.setVolume(0.5);

            let urls = await music.getAllMusicUrls();
            playQueue(connection, urls);

            //play(connection, env.process.TEST_SONG_URL )
        });
    }

    bot.on("messageCreate", async (msg) => { // When a message is created
        console.log(msg.author.username + "#" + msg.author.discriminator + ": " + msg.content);
        //ignore bot messages
        if (msg.author.bot) {
            return;
        }

        //let matches = msg.content.match(/play((\s+with)?\s+?tag)?\s+(.+)\s{0,}/i);
        //
        //if (matches) { 
        //    let tagName = matches.pop();
        //    var urls = await music.getMusicUrlsForTag(tagName);
        //    console.log(urls);

        //    let reply = (urls.length === 0) ? '<:MikuStare:487713111659249690>' : urls.join('\n').toString();
        //    bot.createMessage(msg.channel.id, '`' + reply + '`');

        //    if (urls.length > 0) {
        //        bot.joinVoiceChannel(process.env.GUILD_RADIO_ID).catch((err) => { // Join the user's voice channel
        //            console.log(err); // Log the error
        //        }).then((connection) => {
        //            console.log('connection.piper.encoding', connection.piper.encoding);
        //            console.log('connection.playing', connection.playing);
        //            
        //            MusicQueue.urls = urls;
        //        });
        //    }
        //}

        matches = msg.content.match(/add\s+song\s+(?<url>[^\s]+)/i);

        if (matches) {
            //add song to database check title and uploader for tags matching tags and add them if they excist
            console.log(matches);
            let url = matches.groups.url;
            console.log('url: ' + url);

            if (url.match(/bandcamp\.com\/track\//i)) {
                let musicFileName = await music.getMusicFilenameFromUrl(url)

                console.log(musicFileName)
                console.log('bandcamp track url detected..')

                if (musicFileName[0]) {
                    console.log('song already in database..')
                    // reply in chat here?
                }
                else {
                    exec('youtube-dl.exe ' + url + ' -o music/%(title)s-%(id)s.%(ext)s --print-json', function( error, stdout, stderr) {
                        if ( error != null ) {
                            console.log(stderr);
                            // error handling & exit
                            return;
                        }
                        console.log(stdout)
                        let data = JSON.parse(stdout);
                        console.log(data)

                        console.log('song not in database...')
                        console.log('adding \' ' + data.title + ' \' into database')
                        music.createSong(url, data.title, data._filename, data.artist, data.album, data.track, data.thumbnail)
                    });
                }
            }


            if (url.match(/bandcamp\.com\/album\//i)) {
                console.log('bandcamp album detected..')
                //handle each track seperately?
            }

            //let info = await ytdl.getInfo(url);
            //console.log(info);
            //console.log(
            //    info.videoDetails.title + '\n' +
            //    info.videoDetails.ownerChannelName
            //    //info.videoDetails.author.name 
            //    //info.videoDetails.author.user
            //);
            //if (info.videoDetails.keywords) {
            //    console.log("keywords found.");
            //    console.log(info.videoDetails.keywords);
            //} else {
            //    console.log("no keywords where found D:");
            //}

            //(feat|ft)[\.\s](\s+)?(?<feat>.+\w)
            //\s+(?<name>.+\w?)\s(Official?)// depricated //
            //.replace(/\s?official\.?[\s\.]?/i, '').trim()
            //info.videoDetails.keywords
            
        }

        matches = msg.content.match(/add\s+tag\s+(?<tag>.+\S)/i);

        if (matches) {
            //add tag to table 東方
            console.log(matches);
            let tagName = matches.groups.tag;
            console.log(tagName);
            t = await music.createTag(tagName);
            console.log(t);
        }

        matches = msg.content.match(/ignore\s+tag\s+(?<tag>.+\S)/i);

        if (matches) {
            console.log("searching for tag: " + matches.groups.tag);
            let result = await music.setIgnoreTag(matches.groups.tag);
            console.log('ignore', matches.groups.tag, result);
        }

        matches = msg.content.match(/add\s+alias\s+(?<alias>.+\S)(\s+)?\|(\s+)?(?<tag>.+\S)/i);

        if (matches) {
            //add alias to tags?
            console.log(matches);
        }

        matches = msg.content.match(/tag\s+song\s+([^\s]+)\s+(with\s+)?(.+)/i);

        if (matches) {
            //add tag to song that already exists in db
            
        }

        matches = msg.content.match(/music\s+tags/i);

        if (matches) {
            console.log('returning tags... ');
            bot.createMessage(msg.channel.id, 
                (await music.getTags()).map(x => x.name).join(', ').toString()
                );

            console.log(await music.getTags());
        }

        matches = msg.content.match(/search\s+tags?\s+(?<search>.+)/i);

        if (matches) {
            let search = matches.groups.search;
            console.log('searching tags... ', search);

            let tagResults = await music.searchTags(search);

            if (tagResults.length === 0) {
                bot.createMessage(msg.channel.id, 'got nothing hun uwu~');
            }
            else {
                let tagNames = { };

                for (let index = 0; index < tagResults.length; index++) {
                    const tag = tagResults[index];

                    if (!music.isTagRoot(tag.id)) {
                        if (tag.id in tagNames) {
                            continue;
                        }

                        tag = await music.getRootTagParent(tag.id);
                    }

                    tagNames[tag.id] = tag.name;

                    let descendents = await music.getTagDescendants(tag.id);

                    for (let x = 0; x < descendents.length; x++) {
                        const child = descendents[x];
                        tagNames[child.id] = child.name;
                    }
                }

                let tagNamesString = Object.values(tagNames).join(', ').toString();
                console.log('search tags', search, tagNamesString, tagResults);
                bot.createMessage(msg.channel.id, tagNamesString);
                
            }

            
        }

        if (msg.content === '⏭️') {
            bot.joinVoiceChannel(process.env.GUILD_RADIO_ID).catch((err) => { // Join the user's voice channel
            console.log(err); // Log the error
            }).then((connection) => {
                if(connection.playing) { // Stop playing if the connection is playing something
                    connection.stopPlaying();
                }
            });
        }

       //if (msg.content === "test music") {
       //    bot.joinVoiceChannel(process.env.GUILD_RADIO_ID).catch((err) => { // Join the user's voice channel
       //    console.log(err); // Log the error
       //    }).then((connection) => {
       //        if(connection.playing) { // Stop playing if the connection is playing something
       //            connection.stopPlaying();
       //        }
       //        connection.updateVoiceState(false, true);
       //        connection.play("./test.m4a");
       //    });
       //}

        //if (msg.content === "test ytdl") {
        //    bot.joinVoiceChannel(process.env.GUILD_RADIO_ID).catch((err) => { // Join the user's voice channel
        //        console.log(err); // Log the error
        //    }).then((connection) => {
        //        if(connection.playing) { // Stop playing if the connection is playing something
        //            connection.stopPlaying();
        //        }
        //        connection.updateVoiceState(false, true);
        //        var url = '';
        //        console.log(ytdl.validateURL(url));
        //        play(connection, url);
        //    });
        //}

        if (msg.content === "test youtubedl") {
            bot.joinVoiceChannel(process.env.GUILD_RADIO_ID).catch((err) => { // Join the user's voice channel
                console.log(err); // Log the error
            }).then((connection) => {
                if(connection.playing) { // Stop playing if the connection is playing something
                    connection.stopPlaying();
                }
                connection.updateVoiceState(false, true);


                //check video is in db and if not download it?
                var exec = require('child_process').exec;

                let url = process.env.TEST_SONG_URL
                var child = exec('youtube-dl.exe ' + url + ' -o output2.mp3', function( error, stdout, stderr) {
                    if ( error != null ) {
                        console.log(stderr);
                        // error handling & exit
                        return;
                    }
                    connection.play("./output2.mp3");
                });
            });
        }

        if (msg.content === "test youtubedl 2") {
            bot.joinVoiceChannel(process.env.GUILD_RADIO_ID).catch((err) => { // Join the user's voice channel
                console.log(err); // Log the error
            }).then((connection) => {
                if(connection.playing) { // Stop playing if the connection is playing something
                    connection.stopPlaying();
                }
                connection.updateVoiceState(false, true);


                //check video is in db and if not download it?
                
                let url = process.env.TEST_SONG_URL
                exec('youtube-dl.exe ' + url + ' --print-json', function( error, stdout, stderr) {
                    if ( error != null ) {
                        console.log(stderr);
                        // error handling & exit
                        return;
                    }
                    console.log(stdout)
                    let data = JSON.parse(stdout);
                    console.log(data)
                    //console.log(data);
                    //console.log(data.title)
                    //connection.play("./output.mp3"); 
                });
            });
        }

        if (msg.content === "test youtubedl 3") {
            bot.joinVoiceChannel("829286533395120149").catch((err) => { // Join the user's voice channel
                console.log(err); // Log the error
            }).then((connection) => {
                if(connection.playing) { // Stop playing if the connection is playing something
                    connection.stopPlaying();
                }
                connection.updateVoiceState(false, true);

                let url = process.env.TEST_SONG_URL
                play(connection, url)
            });
        }

        if (msg.content === "test command 1") {
            console.log('running test command 1')
            let url = process.env.TEST_SONG_URL;
            let musicFileName = await music.getMusicFilenameFromUrl(url);
            console.log(musicFileName);

            if (musicFileName[0]) {
                console.log('woo')
            }
        }
    });

    bot.connect(); // Get the bot to connect to Discord

})();

//async function stream(url) { 
//    return await ytdl(url, { type: 'opus' });
//}

//async function play(connection, url) {
//    connection.play(await ytdl(url), { type: 'opus' });
//}
