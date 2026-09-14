import { useState } from 'react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Sorrisos',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🫣','🤭','🫡','🤫','🤥','😶','🫠','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  },
  {
    label: 'Gestos',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','👀','👁️','👅','🫦','🦷','🫁','🫀','🧠','🦷'],
  },
  {
    label: 'Pessoas',
    emojis: ['👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','👴','👵','🧓','👮','💂','🕵️','👷','🫅','🤴','👸','🧙','🧚','🧛','🧜','🧝','🧞','🧟','🧌','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','👫','👬','👭','💑','👨‍👩‍👦','👨‍👩‍👧','🧑‍🤝‍🧑'],
  },
  {
    label: 'Natureza',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🌸','🌺','🌻','🌹','🍀','🌿','🌱','🌲','🌳','🌴','🌵','🍄','🐚','🪸','🌾','💐','🌷'],
  },
  {
    label: 'Comida',
    emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉'],
  },
  {
    label: 'Símbolos',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🕉️','☪️','✡️','🔯','☦️','☸️','⚛️','🛐','⛎','🆗','🆙','🆒','🆕','🆓','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','⬛','⬜','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','🟫','🔈','🔉','🔊','📣','📢','💬','💭','🗯️','🔔','🔕','🎵','🎶','⚠️','🚫','✅','❌','❎','🔱','⚜️','🔰','♻️','✔️','🔝','🔛','🔜','🔚'],
  },
];

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
    : CATEGORIES[activeCategory].emojis;

  return (
    <div className="w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden">
      <div className="p-2 border-b border-slate-800">
        <input
          type="text"
          placeholder="Pesquisar emoji..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800/50 text-slate-100 text-sm rounded-lg px-3 py-1.5 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {!search && (
        <div className="flex gap-1 px-2 pt-2">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(i)}
              className={`flex-1 text-xs py-1 rounded-md transition-colors ${
                activeCategory === i
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {cat.label.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-52 overflow-y-auto">
        {filtered.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            onClick={() => onEmojiSelect(emoji)}
            className="text-xl p-1 rounded hover:bg-slate-800 transition-colors leading-none"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-8 text-center text-slate-600 text-sm py-4">
            Nenhum emoji encontrado
          </div>
        )}
      </div>
    </div>
  );
}
