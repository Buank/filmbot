
let app = new Vue({
    el: '#appVue',
    data: {
        channelList: [],
        id_channel:'',
        length_channels: '',
        last_video: '',
        add_video: '',
        error_video: '',
        error_youtube: '',
        showstream_er: '',
        rejected_video: [],
        id_ChannelVideos: '',
    },
    methods: {
        get_channel_list: function () {
            axios
                .get('/channelList')
                .then(response => {
                   this.channelList = response.data;
                   this.length_channels = response.data.length;
                });
        },
        idChannel:function () {
            let idChannel = this.id_channel;
            if (idChannel === ''){
                error.text = 'ID канала не должно быть пустым!';
                noty(error);
            }else{
                let params = {
                    id_channel: idChannel,
                };
                JSON.stringify(params);

                axios
                .post('/channelList',params)
                    .then(response => {
                        success.text = 'Вы успешно подписались';
                        noty(success);
                    })
                    .catch((error) => {
                        console.log(error);
                        error.text = 'Вы уже подписались на этот канала!';
                        noty(error);
                    });
            }
        },
        idChannelVideos:function () {
            let id = this.id_ChannelVideos;
            if (id === ''){
                error.text = 'ID канала не должно быть пустым!';
                noty(error);
            }else{
                let params = {
                    channel_id: id,
                };
                // JSON.stringify(params);

                axios
                    .post('/channelAllVideos/',params)
                    .then(response => {
                        success.text = 'Вы успешно подписались';
                        noty(success);
                    })
                    .catch((error) => {
                        error.text = 'Вы уже подписались на этот канала!';
                        noty(error);
                    });
            }
        }
    },
    created: function () {
        axios
            .get('/channelList')
            .then(response => {
                this.channelList = response.data;
                this.length_channels = response.data.length;
            });
        axios
            .get('/statistics')
            .then(response => {
                this.last_video = response.data.cron_last_video;
                this.add_video = response.data.add_video;
                this.error_video = response.data.error_video;
                this.error_youtube = response.data.youtube_error;
                this.showstream_er = response.data.showstream_er;
            });
        axios
            .get('/rejectedVideos')
            .then(response => {
                this.rejected_video = response.data.videos;
            });
    }
});