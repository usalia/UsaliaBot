class MusicRepository {

    constructor(knex) {
        this.knex = knex;
    }
    
    async getAllMusic() {
        return await this.knex('music')
            .select('music.*');
    }

    async getAllMusicUrls() {
        return (await this.getAllMusic()).map(m => m.url);
    }

    async getTags() {
        return this.knex.select().table('tag');
    }

    async getTagById(tagId) {
        return this.knex.select()
            .table('tag')
            .where('id', '=',  tagId)
            .first();
    }

    async searchTags(searchTerm) {
        return this.knex.select()
            .table('tag')
            .where('tag.name', 'LIKE',  '%' + searchTerm + '%');
    }

    async isTagRoot(tagId) {
        return this.knex.select()
            .table('tag')
            .where('id', '=', tagId)
            .whereNull('parent_id');
    }

    async getTagParent(tagId) {
        if (this.isTagRoot(tagId)) {
            return this.getTagById(tagId);
        }

        return this.knex.select()
            .table('tag')
            .where('tag.parent_id', '=', tagId);
    }

    async getRootTagParent(tagId) {
        let tag = null;

        while(!tag || tag.parent_id) {
            tag = await this.getTagParent(tag ? tag.parent_id : tagId);
        }

        return tag;
    }

    async getTagChildren(tagParentId) {
        return this.knex.select()
            .table('tag')
            .where('tag.parent_id', '=', tagParentId);
    }

    async getTagDescendants(tagParentId) {
        let result = [ ];

        let tags = await this.getTagChildren(tagParentId);

        for (let i = 0; i < tags.length; i++) {
            result.push(tags[i]);

            let children = await this.getTagDescendants(tags[i].id);
            for (let x = 0; x < children.length; x++) {
                result.push(children[x]);
            }
        }

        return result;
    }

    async getMusicForTag(tag) {
        return await this.knex('music')
            .select('music.*')
            .join('music_tag', 'music_tag.music_id', 'music.id')
            .join('tag', 'tag.id', 'music_tag.tag_id')
            .where('tag.name', 'LIKE',  '%' + tag + '%')
            .groupBy('music.id');
    }

    async getMusicUrlsForTag(tag) {
        let music = await this.getMusicForTag(tag);
        return music.map(m => m.url);
    }

    async getMusicFilenameFromUrl(url) {
        return await this.knex('music').where({
            url: url
        }).select('filename')
    }

    async createTag(tag) {
        return await this.knex('tag').insert({
            name: tag
        });
    }

    async createSong(url, title, filename, artist, album, track, thumbnail) {
        return await this.knex('music').insert({
            name: title,
            url: url,
            filename: filename,
            artist: artist,
            album: album,
            track: track,
            thumbnail: thumbnail
        });
    }

    async setIgnoreTag(tagName, ignore = true) {
        return await this.knex('tag')
            .update('ignore', ignore ? 1 : 0)
            .where('name', '=',  tagName)
            .where('ignore', '=',  ignore ? 0 : 1);
            
    }

}

module.exports = MusicRepository;