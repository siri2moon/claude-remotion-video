"""Cầu nối Node → VieNeu-TTS.

Đọc một job JSON trên stdin, sinh một file wav cho MỖI DÒNG thoại, in kết quả
JSON ra stdout.

Vì sao mỗi dòng một file: dòng phụ đề trên màn hình phải bật/tắt đúng lúc giọng
đọc dòng đó. Sinh cả bài thành một file rồi đi dò lại bằng whisper là làm ngược
và luôn sai vài trăm mili giây. Cắt sẵn từng dòng thì thời lượng là sự thật, đo
bằng chính số mẫu của file.

Job:
  {"voice": "Thanh Bình" | null,
   "refAudio": "/đường/dẫn/mau-giong.wav" | null,
   "outDir": "...",
   "seed": 0,
   "lines": [{"id": "l001", "text": "..."}, ...]}

Kết quả:
  {"sampleRate": 48000, "voice": "...",
   "lines": [{"id": "l001", "file": "l001.wav", "sec": 2.72}, ...]}
"""

import json
import os
import sys
import time
from pathlib import Path


def main() -> int:
    job = json.load(sys.stdin)
    out_dir = Path(job["outDir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    t_load = time.time()
    from vieneu import Vieneu

    tts = Vieneu()  # v3turbo — trên Apple Silicon đường ONNX nhanh hơn MPS
    load_sec = time.time() - t_load

    ref_audio = job.get("refAudio")
    voice = job.get("voice")

    if ref_audio:
        # Nhân bản giọng: nạp mẫu một lần, dùng lại cho mọi dòng.
        voice = tts.add_voice("user", ref_audio, denoise=True)
        print(f"[tts] nhân bản giọng từ {ref_audio}", file=sys.stderr)
    else:
        presets = {name for _, name in tts.list_preset_voices()}
        if voice not in presets:
            print(
                f"ERROR  giọng '{voice}' không có. Chọn một trong: {sorted(presets)}",
                file=sys.stderr,
            )
            return 1

    results = []
    t_synth = time.time()
    for item in job["lines"]:
        at = time.time()
        wav = tts.infer(item["text"], voice=voice)
        path = out_dir / f"{item['id']}.wav"
        tts.save(wav, path)
        sec = len(wav) / tts.sample_rate
        results.append({"id": item["id"], "file": path.name, "sec": round(sec, 4)})
        print(
            f"[tts] {item['id']}  {sec:5.2f}s tiếng / {time.time()-at:5.2f}s máy  {item['text'][:46]}",
            file=sys.stderr,
        )
    synth_sec = time.time() - t_synth

    json.dump(
        {
            "sampleRate": tts.sample_rate,
            "voice": str(voice),
            "loadSec": round(load_sec, 2),
            "synthSec": round(synth_sec, 2),
            "lines": results,
        },
        sys.stdout,
        ensure_ascii=False,
    )
    sys.stdout.flush()
    sys.stderr.flush()

    # Thoát thẳng, bỏ qua toàn bộ destructor.
    #
    # Lý do: khi nhân bản giọng (có torch nạp cùng ONNX Runtime), lúc giải phóng
    # bộ nhớ hay ném "recursive_mutex lock failed" và tiến trình chết với mã lỗi
    # — dù mọi file wav đã ghi xong và JSON đã in ra. Node ở đầu kia chỉ nhìn mã
    # thoát nên tưởng cả stage hỏng. tts.close() không chặn được.
    #
    # Tới đây thì mọi thứ đã nằm trên đĩa và stdout đã flush, nên bỏ qua dọn dẹp
    # là an toàn tuyệt đối.
    os._exit(0)


if __name__ == "__main__":
    sys.exit(main())
