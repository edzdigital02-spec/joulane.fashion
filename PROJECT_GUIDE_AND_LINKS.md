# 👑 دليل روابط ومعلومات متجر JOULANE Fashion الكامل

هذا الملف يحتوي على **جميع الروابط الحية، لوحات التحكم، لوحة المخزن المخصصة، والمنصات السحابية المشغلة للمتجر بالكامل**، ويتم تحديثه تلقائياً باستمرار.

---

## 🌐 1. روابط المتجر الأساسية (الروابط الحية والمحلية)

### 🛍️ المتجر المباشر على الإنترنت (الذي يراه الزبائن):
- **رابط المتجر:** [https://joulane-fashiondz.vercel.app/](https://joulane-fashiondz.vercel.app/)
- **رابط لوحة التحكم الرئيسية أونلاين:** [https://joulane-fashiondz.vercel.app/#admin](https://joulane-fashiondz.vercel.app/#admin)
- **رابط لوحة إدارة المخزون المخصصة للعمال أونلاين:** [https://joulane-fashiondz.vercel.app/#stock](https://joulane-fashiondz.vercel.app/#stock)
- **رابط تطبيق أندرويد لتثبيته فوراً (Stock Joulane APK):** [https://joulane-fashiondz.vercel.app/Stock_Joulane.apk](https://joulane-fashiondz.vercel.app/Stock_Joulane.apk)
- **مسار ملف الـ APK الحقيقي على سطح مكتب حاسوبك:** `C:\Users\GAMER ZONE\Desktop\Joulane\Stock_Joulane.apk`
  - 🔑 **رمز المرور الافتراضي للوحات:** `1234`

---

### 💻 التطبيق المحلي على حاسوبك (Offline App):
- **رابط المتجر المحلي:** [http://localhost:5173/](http://localhost:5173/)
- **رابط لوحة التحكم الرئيسية المحلية:** [http://localhost:5173/#admin](http://localhost:5173/#admin)
- **رابط لوحة إدارة المخزون المحلية:** [http://localhost:5173/#stock](http://localhost:5173/#stock)

---

## ☁️ 2. المنصات السحابية المشغلة للمتجر (Cloud Platforms)

| المنصة | الغرض والوظيفة | رابط لوحة التحكم للمنصة |
| :--- | :--- | :--- |
| **Supabase** | قاعدة البيانات السحابية الحية (المسؤولة عن السينك والمزامنة الفورية بين حاسوبك والموقع أونلاين ولوحة المخزن في الوقت الحقيقي) | [https://supabase.com/dashboard/project/jsnsmqwznjllqmnzfrx](https://supabase.com/dashboard/project/jsnsmqwznjllqmnzfrx) |
| **Vercel** | استضافة الموقع واستضافة السيرفر المباشر على الإنترنت | [https://vercel.com/](https://vercel.com/) |
| **Cloudinary** | استضافة الصور وسحابة تخزين صور المنتجات والأحذية فائقة السرعة | [https://console.cloudinary.com/](https://console.cloudinary.com/) |
| **GitHub** | مستودع حفظ الشفرة المصدرية والكود المصدري للمشروع | [https://github.com/edzdigital02-spec/joulane.fashion](https://github.com/edzdigital02-spec/joulane.fashion) |

---

## 💡 3. كيف يعمل نظام المتجر والتطبيق معاً؟ (Architecture)

1. **المزامنة الحية (Real-Time Sync via Supabase):**
   - عند إضافة منتج جديد، تعديل أسعار، إخفاء الأسعار، أو تغيير الكراطين من لوحة المخزن `#stock` أو حاسوبك، يتم التحديث **فوراً وفي الوقت الحقيقي** على موقع الزبائن أونلاين بدون إعادة الرفع.

2. **رفع الصور التلقائي (Cloudinary & Local Storage):**
   - عند اختيار صورة حذاء من حاسوبك، يتم معالجتها أوتوماتيكياً للحفاظ على سرعة فائقة للموقع على هواتف الزبائن.

3. **استقبال الطلبات (Unified Orders System):**
   - عندما يطلب زبون حذاء من الموقع، يتم توليد رسالة واتساب مفصلة بأسماء الأحذية والكميات والولايات، وتسجيل الطلب في لوحة التحكم.

---

## 📁 4. ملفات النشر المحفوظة على حاسوبك

- **مجلد النشر الكامل السريع:**
  `C:\Users\GAMER ZONE\Desktop\Joulane\JOULANE_READY_FOR_UPLOAD`
- **الملف المضغوط للنشر (ZIP):**
  `C:\Users\GAMER ZONE\Desktop\Joulane\JOULANE_READY_FOR_UPLOAD.zip`
- **النسخة الخفيفة جداً (240 KB):**
  `C:\Users\GAMER ZONE\Desktop\Joulane\JOULANE_LIGHTWEIGHT_NO_PHOTOS.zip`
