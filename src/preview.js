// Bandcamp's official embedded player for the album on show.
// The server looks up the numeric album id at /preview. The iframe is inserted
// only when the visitor clicks the button, so nothing plays by itself.
const root = document.getElementById('audio');
let token = 0; // bumps on every album change

const html = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter(Boolean));
  return n;
};

function render(bandcampId) {
  if (!bandcampId) {
    root.hidden = true;
    root.replaceChildren();
    return;
  }
  root.hidden = false;
  const slot = html('div', { className: 'audio-bc' });
  const btn = html('button', { type: 'button', className: 'audio-bc-btn', textContent: 'listen to the full album on Bandcamp' });
  btn.onclick = () => {
    slot.replaceChildren(
      html('iframe', {
        title: 'Bandcamp player',
        src: `https://bandcamp.com/EmbeddedPlayer/album=${bandcampId}/size=small/bgcol=222222/linkcol=ffffff/transparent=true/`,
        loading: 'lazy',
        allow: 'autoplay',
        height: 42,
      }),
    );
  };
  slot.append(btn);
  root.replaceChildren(slot);
}

// Called whenever a new album is shown.
export function setAlbum(pick) {
  const mine = ++token;
  render(null);
  if (!pick.links?.bandcamp) return;
  const q = new URLSearchParams({ artist: pick.artist, album: pick.album, bandcamp: pick.links.bandcamp });
  fetch(`/preview?${q}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (mine === token && d?.bandcampId) render(d.bandcampId);
    })
    .catch(() => {});
}
