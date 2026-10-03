# Framework viết kịch bản TikTok Selfie Storytelling

Đọc hết file này trước khi viết. Đây là phần "chất", `output-format.md` là phần "khuôn".

---

## A. Tone & Voice

**Nguyên tắc gốc:** viết như đang gọi video cho thằng bạn thân, không phải như đang quay TED Talk.

Nên:
- Câu ngắn, ≤ 15 từ. Nói xong một ý thì ngắt.
- Động từ mạnh, hình ảnh cụ thể: "log đỏ lòm", "đi vào lòng đất", "deadline dí sát gáy".
- Có chỗ tự vấp, tự cười, tự chửi mình. Sự không hoàn hảo tạo cảm giác thật.
- Cà khịa nhẹ, hiểu chuyện — cà khịa cái *tình huống*, không cà khịa *con người*.

Cấm:
- Giọng giảng đạo: "hãy...", "chúng ta cần phải...", "bạn có biết rằng...", "điều quan trọng là...".
- Đạo lý sáo rỗng không có ví dụ đi kèm.
- Từ ngữ marketing: "bí quyết", "sự thật gây sốc", "99% mọi người không biết".
- Xúc phạm nghề nghiệp, vùng miền, giới tính, ngoại hình.

---

## B. Công thức 4 khối + ngân sách thời gian

Tỉ lệ chuẩn (áp cho mọi `durationSec`, làm tròn về giây):

| Khối | Tỉ lệ | Ở 38s | Nhiệm vụ duy nhất |
|---|---|---|---|
| **1. Hook** | 8% | 0:00 – 0:03 | Giữ chân 3 giây. Không giải thích gì cả. |
| **2. Story / Context** | 45% | 0:03 – 0:20 | Kể 1 tình huống đời thực để người xem thấy mình trong đó. |
| **3. Punchline & Quote** | 30% | 0:20 – 0:32 | Đọc nguyên văn châm ngôn + bẻ lái nó theo góc nhìn mới. |
| **4. CTA** | 17% | 0:32 – 0:38 | Kích bình luận / tag bạn. |

Khối Story có thể tách thành 2 scene (mở tình huống → cao trào) nếu `durationSec` ≥ 35.
Tối thiểu 4 scene, tối đa 6 scene.

Ràng buộc cứng:
- Hook ≤ 4 giây.
- CTA từ 4 đến 10 giây.
- Scene đầu tiên `role: "hook"`, scene cuối cùng `role: "cta"`.
- Phải có ≥ 1 scene `role: "story"` và đúng 1 scene `role: "punchline"`.

---

## C. Thư viện Hook — chọn 1 pattern

Nghĩ 3 hook theo 3 pattern khác nhau, chọn cái sắc nhất.

| # | Pattern | Cách làm | Ví dụ khung |
|---|---|---|---|
| 1 | **Đảo ngược kỳ vọng** | Đọc nửa câu quote nghiêm túc → bẻ ngoặt | "Nhân chi sơ, tính bản thiện... Tự nhiên sinh ra đâu ai muốn cà khịa ai!" |
| 2 | **Thú nhận sốc** | Tự tố mình làm điều mình từng chê | "Tôi vừa làm cái việc mà 5 năm trước tôi thề sẽ không bao giờ làm." |
| 3 | **Câu hỏi cứa** | Hỏi trúng nỗi đau chung | "Anh em có bao giờ deploy xong rồi mới nhớ ra là chưa merge không?" |
| 4 | **Con số cụ thể** | Mở bằng thời gian/số liệu trần trụi | "3 giờ sáng. Bug thứ 14. Và nó nằm ở một dấu chấm phẩy." |
| 5 | **Trích lời người khác** | Nhại nguyên văn câu nói kinh điển | "Sếp tôi bảo: 'Em làm nhanh giúp anh, đơn giản thôi mà'." |
| 6 | **Hình ảnh bất lực** | Không nói ngay — cười trừ, lắc đầu, thở dài rồi mới vào | "(thở dài) ...Thôi để tôi kể anh em nghe." |
| 7 | **Phủ định thẳng** | Bảo câu châm ngôn sai | "Câu này sai. Ít nhất là với dân đi làm." |
| 8 | **Cắt giữa câu** | Bắt đầu như đang nói dở, tạo cảm giác lọt vào giữa cuộc trò chuyện | "...và đó là lần thứ ba trong tuần." |

Luật hook:
- ≤ 20 từ.
- Phải chứa hoặc gợi trực tiếp tới câu quote — người xem lướt qua vẫn biết video nói về cái gì.
- Không mở bằng "Chào anh em", "Hôm nay mình sẽ chia sẻ". Vào thẳng.

---

## D. Story — chất liệu và luật

### Ngân hàng tình huống (gợi ý, đừng dùng lại nguyên si)

Dev / IT:
- "Em chạy trên máy em bình thường mà."
- Estimate 2 ngày, làm 2 tuần, demo vẫn crash.
- Fix bug 4 tiếng, hoá ra thiếu một dấu.
- Deploy chiều thứ 6. Rồi trực điện thoại cả cuối tuần.
- Code review 200 comment, 190 cái về format.
- Ticket "urgent" thứ 15 trong tuần.
- Refactor "sửa tí xíu thôi" → đụng vào 40 file.

Khách hàng / sếp:
- "Làm tính năng giống Facebook, ngân sách 2 triệu."
- "Xong chưa em?" — hỏi 20 phút sau khi giao việc.
- Chốt requirement xong, hôm sau đổi.
- "Anh không rành kỹ thuật, em thấy sao thì làm."

Văn phòng chung:
- Meeting 45 phút mà lẽ ra là một cái email.
- Daily standup thành daily kể chuyện.
- Đi làm sớm 30 phút để có 30 phút không ai làm phiền.
- Nhắn "ok anh" xong ngồi thở dài.

### Luật viết Story

1. **Một tình huống, đào sâu.** Ba tình huống hời hợt luôn thua một tình huống có chi tiết.
2. **Bắt buộc có ≥ 1 câu thoại trực tiếp** của người khác, đặt trong ngoặc kép. Đây là thứ tạo cảm giác thật nhất trong toàn bộ kịch bản.
3. **Bắt buộc có ≥ 1 chi tiết cụ thể**: con số, giờ giấc, tên công cụ, tên file.
4. Người xem phải "thấy bóng dáng mình" **trước giây thứ 12**. Nếu tới giây 12 vẫn đang dẫn dắt → cắt bớt.
5. Kể ở thì quá khứ, ngôi thứ nhất. Không kể chuyện "có một người bạn của tôi".

---

## E. Punchline — kỹ thuật bẻ lái châm ngôn

Đây là khối quyết định video có được lưu/share không.

**Bắt buộc:** đọc nguyên văn câu quote đúng 1 lần trong khối này, chậm hơn phần còn lại.

5 kỹ thuật bẻ lái (chọn 1):

| # | Kỹ thuật | Cách làm |
|---|---|---|
| 1 | **Đảo vế** | Giữ vế đầu trang trọng, thay vế sau bằng thực tế phũ phàng |
| 2 | **Thêm điều kiện** | "Câu này đúng — nhưng chỉ đúng khi anh em chưa có deadline." |
| 3 | **Đổi chủ thể** | Câu vốn nói về người này, áp sang người khác cho lệch pha |
| 4 | **Hạ cấp** | Câu triết lý cao siêu → dịch sang ngôn ngữ đi làm |
| 5 | **Nâng cấp** | Chuyện vụn vặt hàng ngày → nâng lên thành nguyên tắc sống |

Kết khối bằng **1 câu chốt ≤ 12 từ**. Câu này sẽ được dùng làm caption đăng bài và làm text
highlight to nhất trong video. Viết nó cho đáng.

Cấm: giải nghĩa câu châm ngôn theo kiểu từ điển ("câu này có nghĩa là...").

---

## F. CTA

Chọn 1:

| Pattern | Khung câu |
|---|---|
| **Hỏi trải nghiệm** | "Anh em có ngày nào phải kiềm chế cái sự ... này không?" |
| **Kêu tag** | "Tag ngay cái đứa hay làm ông ... vào đây xem nào." |
| **Chia phe** | "Team im lặng cho lành hay team nói cho nhẹ người?" |
| **Xin lời khuyên ngược** | "Ai có cách trị cái này thì chỉ tôi với, tôi nghiêm túc đấy." |

Luật:
- Câu hỏi phải **cụ thể**, trả lời được bằng 1 câu bình luận. "Anh em nghĩ sao?" là CTA chết.
- Không "like share subscribe" khô khan.
- Caption CTA nên có 1 emoji chỉ hướng (👇) hoặc cảm xúc.

---

## G. Chữ trên màn hình (Caption)

Caption **không phải phụ đề transcript**. Nó là tiêu đề của khối, giúp người xem tắt tiếng vẫn hiểu.

- Ngọt nhất ≤ 60 ký tự. Trần cứng 90 ký tự.
- Highlight 1–3 từ khoá (field `caption.highlight`) — mỗi phần tử phải là **substring xuất hiện
  nguyên văn** trong `caption.text`, khớp cả dấu và hoa thường.
- Tối đa 1 emoji mỗi caption, chỉ dùng ở hook / punchline / cta.

Preset style:

| `caption.style` | Dùng ở | Ý đồ hiển thị |
|---|---|---|
| `hook` | scene hook | Chữ to nhất, highlight vàng |
| `normal` | scene story | Trắng, cỡ vừa |
| `punch` | scene punchline | Vàng, pop scale khi xuất hiện |
| `cta` | scene cta | Xanh lá + emoji, có mũi tên xuống |

---

## H. Production specs (ghi vào phần ghi chú của `script.md`)

Hình:
- 9:16, 1080×1920, 30fps. Quay selfie / talking head.
- Đổi góc máy giữa các khối (sát mặt → ngang tầm mắt → nghiêng đầu) để tạo nhịp.

Tiếng:
- Micro cài áo, tiếng rõ.
- BGM: lofi nhẹ / beat tấu hài công sở / chillout, âm lượng **10–15%**.
- SFX nhấn vào điểm buồn cười, ngạc nhiên, thở dài.

Hậu kỳ:
- **Jump-cut** cắt sạch khoảng lặng và từ ậm ừ.
- Phụ đề động xuất hiện theo nhịp nói (từng từ / cụm 2–3 từ).
- Highlight từ khoá bằng vàng hoặc xanh lá.

Danh sách `sfx` hợp lệ: `swoosh`, `pop`, `ding`, `sigh`, `record-scratch`, `typing`, `notification`, `boom`, `riser`.

---

## I. Anti-patterns — đọc lại trước khi ghi file

- ❌ Story chung chung, không có con số / không có câu thoại trực tiếp.
- ❌ Giải nghĩa câu châm ngôn như bài văn nghị luận lớp 9.
- ❌ Hook dài quá 4 giây hoặc mở bằng lời chào.
- ❌ Nhồi > 7 từ/giây vào voiceover (validator sẽ WARN).
- ❌ Caption dài bằng nguyên câu voiceover.
- ❌ Kết bằng đạo lý mà không có cú twist nào.
- ❌ CTA hỏi chung chung không ai buồn trả lời.
- ❌ Dùng lại ví dụ trong `assets/example/`.
