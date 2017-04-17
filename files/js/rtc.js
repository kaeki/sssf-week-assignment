
document.querySelector('#connectBtn').addEventListener('click', (evt) => {
    const room = document.querySelector('#room');
    if(room.value == ''){
        room.value = 'plumbus';
    }
    const nick = document.cookie.split('=')[1];
    document.querySelector('#userName').innerText = nick;
    const rtc = new SimpleWebRTC({
        url: 'https://localhost:8888',
        localVideoEl: 'localVideo',
        remoteVideosEl: '',
        nick: nick,
        autoRequestMedia: true,
    });
    startVideoChat(rtc, room.value);
    
});

function startVideoChat(webrtc, roomName) {
    console.log('start');
    webrtc.joinRoom(roomName);

    webrtc.on('videoAdded', function (video, peer) {
        console.log('video added', peer);
        const remotes = document.getElementById('remotes');
        if (remotes) {
            const container = document.createElement('div');
            container.className = 'videoContainer';
            container.id = 'container_' + webrtc.getDomId(peer);
            const title = document.createElement('h3');
            title.innerText = peer.nick;
            container.appendChild(title);
            container.appendChild(video);

            // suppress contextmenu
            video.oncontextmenu = function () { return false; };

            remotes.appendChild(container);
        }
    });

}