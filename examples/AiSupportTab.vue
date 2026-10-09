<!--
  تاب "الدعم العلمي AI" جوه منصة Be First (الطريقة أ-2 في README).
  شغال على Vue 2 و Vue 3 (Options API). حطوه كـ route، مثلًا: { path: "/ai-support", component: AiSupportTab }

  🔌 الحاجة الوحيدة اللي محتاجة تتعدل: studentFromStore() — رجّعوا فيها بيانات الطالب اللي عامل login
     من الـ store/auth بتاعكم (Vuex / Pinia / localStorage ...).
-->
<template>
  <div class="ai-support-tab">
    <iframe
      v-if="src"
      :src="src"
      allow="camera; clipboard-write"
      title="الدعم العلمي AI"
      class="ai-support-frame"
    ></iframe>
    <p v-else class="ai-support-login">سجّل دخولك الأول عشان تستخدم الدعم العلمي AI.</p>
  </div>
</template>

<script>
const AI_URL = "https://aiservice.magacademy.co/befirst-ai/";

export default {
  name: "AiSupportTab",
  props: {
    // اختياري: "jawad" أو "elbasha" عشان يفتح مدرس معيّن على طول (مثلًا من صفحة الكورس)
    teacher: { type: String, default: "" },
  },
  computed: {
    src() {
      const s = this.studentFromStore();
      if (!s || !s.student_id) return "";
      const url = new URL(AI_URL);
      url.searchParams.set("student_id", String(s.student_id));      // 🔌 مطلوب — id ثابت من الداتابيز
      if (s.student_name) url.searchParams.set("student_name", s.student_name); // 🔌 الاسم (الـ AI بينادي بالاسم الأول)
      if (s.grade_name) url.searchParams.set("grade_name", s.grade_name);       // 🔌 الصف (بيظبط مستوى الشرح)
      if (this.teacher) url.hash = this.teacher;
      return url.toString();
    },
  },
  methods: {
    studentFromStore() {
      // 🔌 عدّلوا السطر ده حسب نظامكم. أمثلة:
      //   Vuex:  const u = this.$store.state.auth.user;
      //   Pinia: const u = useAuthStore().user;
      const u = (this.$store && this.$store.state && this.$store.state.auth && this.$store.state.auth.user) || null;
      if (!u) return null;
      return {
        student_id: u.id,
        student_name: u.name,
        grade_name: u.grade && (u.grade.name || u.grade),
      };
    },
  },
};
</script>

<style scoped>
.ai-support-tab { width: 100%; height: calc(100dvh - 64px); /* 🔌 طرح ارتفاع الـ navbar بتاعكم — dvh عشان الكيبورد على الموبايل */ }
.ai-support-frame { width: 100%; height: 100%; border: 0; display: block; background: #050505; }
.ai-support-login { text-align: center; padding: 48px 16px; color: #a39a88; }
</style>
