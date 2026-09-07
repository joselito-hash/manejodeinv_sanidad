import { supabase } from "./supabaseClient.js";

const slides = [...document.querySelectorAll(".slide")];
const dots = [...document.querySelectorAll(".dot")];

const loginForm = document.getElementById("loginForm");
const employeeNumber = document.getElementById("employeeNumber");
const password = document.getElementById("password");
const employeeError = document.getElementById("employeeError");
const passwordError = document.getElementById("passwordError");
const togglePassword = document.getElementById("togglePassword");
const loginMessage = document.getElementById("loginMessage");
const loginButton = document.getElementById("loginButton");
const authBootstrapStatus = document.getElementById("authBootstrapStatus");
const welcomeTransition = document.getElementById("welcomeTransition");
const welcomePhrase = document.getElementById("welcomePhrase");

const forgotPassword = document.getElementById("forgotPassword");
const forgotModal = document.getElementById("forgotModal");
const closeForgotModal = document.getElementById("closeForgotModal");
const forgotDescription = document.getElementById("forgotDescription");
const forgotRequestForm = document.getElementById("forgotRequestForm");
const forgotVerifyForm = document.getElementById("forgotVerifyForm");
const forgotEmployeeNumber = document.getElementById("forgotEmployeeNumber");
const forgotEmail = document.getElementById("forgotEmail");
const forgotCode = document.getElementById("forgotCode");
const forgotNewPassword = document.getElementById("forgotNewPassword");
const forgotConfirmPassword = document.getElementById("forgotConfirmPassword");
const forgotRequestBtn = document.getElementById("forgotRequestBtn");
const forgotVerifyBtn = document.getElementById("forgotVerifyBtn");
const forgotBackBtn = document.getElementById("forgotBackBtn");
const forgotMessage = document.getElementById("forgotMessage");

let currentSlide = 0;
let carouselTimer;
let welcomeTransitionStarted = false;
let recoveryBusy = false;

function getEmployeeNumberFromUser(user, fallback = "") {
  return fallback || String(user?.email || "").split("@")[0];
}

function getWelcomePhrases(name) {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12
    ? `Buen día, ${name}`
    : hour < 19
      ? `Buenas tardes, ${name}`
      : `Buenas noches, ${name}`;

  return [
    timeGreeting,
    `Es un gusto verte, ${name}`,
    `Qué bueno tenerte de vuelta, ${name}`,
    `Todo está listo para ti, ${name}`
  ];
}

async function getWelcomeName(user, fallbackEmployeeNumber) {
  try {
    const { data: profile, error } = await supabase
      .from("perfiles")
      .select("nombre")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (profile?.nombre?.trim()) return profile.nombre.trim();
  } catch (error) {
    console.error("No fue posible obtener el nombre para la bienvenida.", error);
  }

  const employee = getEmployeeNumberFromUser(user, fallbackEmployeeNumber);
  return employee ? `Colaborador ${employee}` : "de nuevo";
}

async function showWelcomeAndRedirect(user, fallbackEmployeeNumber = "") {
  if (welcomeTransitionStarted) return;
  welcomeTransitionStarted = true;
  clearInterval(carouselTimer);

  const name = await getWelcomeName(user, fallbackEmployeeNumber);
  const phrases = getWelcomePhrases(name);
  welcomePhrase.textContent = phrases[Math.floor(Math.random() * phrases.length)];

  authBootstrapStatus.hidden = true;
  welcomeTransition.hidden = false;
  document.body.classList.remove("auth-pending");

  requestAnimationFrame(() => {
    document.body.classList.add("welcome-active");
    welcomeTransition.classList.add("is-visible");
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  await new Promise(resolve => setTimeout(resolve, reduceMotion ? 650 : 2100));
  window.location.replace("/Landing/inventarios.html");
}

function showSlide(index) {
  slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === index);
  });

  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });

  currentSlide = index;
}

function nextSlide() {
  const next = (currentSlide + 1) % slides.length;
  showSlide(next);
}

function startCarousel() {
  clearInterval(carouselTimer);
  carouselTimer = setInterval(nextSlide, 4500);
}

dots.forEach(dot => {
  dot.addEventListener("click", () => {
    showSlide(Number(dot.dataset.index));
    startCarousel();
  });
});

slides.forEach((slide, index) => {
  slide.addEventListener("error", () => {
    slide.style.display = "none";

    const nextAvailable = slides.findIndex(
      (item, i) => i !== index && item.style.display !== "none"
    );

    if (nextAvailable !== -1 && currentSlide === index) {
      showSlide(nextAvailable);
    }
  });
});

togglePassword.addEventListener("click", () => {
  const isHidden = password.type === "password";
  password.type = isHidden ? "text" : "password";
  togglePassword.classList.toggle("is-visible", isHidden);
  togglePassword.setAttribute(
    "aria-label",
    isHidden ? "Ocultar contraseña" : "Mostrar contraseña"
  );
});

function clearErrors() {
  employeeError.textContent = "";
  passwordError.textContent = "";
  loginMessage.textContent = "";
  loginMessage.className = "login-message";
}

function validateForm() {
  clearErrors();

  let valid = true;
  const employeeValue = employeeNumber.value.trim();
  const passwordValue = password.value.trim();

  if (!employeeValue) {
    employeeError.textContent = "Ingresa tu número de colaborador.";
    valid = false;
  } else if (!/^\d+$/.test(employeeValue)) {
    employeeError.textContent = "Utiliza únicamente números.";
    valid = false;
  }

  if (!passwordValue) {
    passwordError.textContent = "Ingresa tu contraseña.";
    valid = false;
  }

  return valid;
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!validateForm()) {
    loginMessage.textContent = "Revisa los datos ingresados.";
    loginMessage.classList.add("error");
    return;
  }

  const employeeValue = employeeNumber.value.trim();
  const passwordValue = password.value;
  const email = `${employeeValue}@sanidad.local`;

  loginButton.disabled = true;
  loginButton.textContent = "Iniciando sesión...";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: passwordValue
    });

    if (error) {
      console.error("No fue posible autenticar al usuario.", error);
      loginMessage.textContent = "Número de colaborador o contraseña incorrectos.";
      loginMessage.classList.add("error");
      return;
    }

    if (document.getElementById("rememberMe").checked) {
      localStorage.setItem("bimboSanidadEmployee", employeeValue);
    } else {
      localStorage.removeItem("bimboSanidadEmployee");
    }

    loginMessage.textContent = "Acceso correcto. Redirigiendo...";
    loginMessage.classList.add("success");
    await showWelcomeAndRedirect(data.user, employeeValue);
  } catch (error) {
    console.error("Error de conexión durante el inicio de sesión.", error);
    loginMessage.textContent = "No fue posible iniciar sesión. Intenta de nuevo.";
    loginMessage.classList.add("error");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Iniciar sesión";
  }
});

const rememberedEmployee = localStorage.getItem("bimboSanidadEmployee");
if (rememberedEmployee) {
  employeeNumber.value = rememberedEmployee;
  document.getElementById("rememberMe").checked = true;
}

function setRecoveryMessage(message = "", type = "") {
  forgotMessage.textContent = message;
  forgotMessage.className = `recovery-message${type ? ` ${type}` : ""}`;
}

function setRecoveryStep(step) {
  const requesting = step === "request";
  forgotRequestForm.hidden = !requesting;
  forgotVerifyForm.hidden = requesting;
  forgotDescription.textContent = requesting
    ? "Confirma tus datos y te enviaremos un código de cinco dígitos."
    : `Escribe el código enviado a ${forgotEmail.value.trim()} y crea una contraseña nueva.`;
  setRecoveryMessage();
  setTimeout(() => (requesting ? forgotEmployeeNumber : forgotCode).focus(), 40);
}

function resetRecoveryState() {
  forgotRequestForm.reset();
  forgotVerifyForm.reset();
  forgotEmployeeNumber.value = employeeNumber.value.trim();
  setRecoveryStep("request");
}

function openRecoveryModal() {
  resetRecoveryState();
  forgotModal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => forgotEmployeeNumber.focus(), 40);
}

function closeModal() {
  if (recoveryBusy) return;
  forgotModal.hidden = true;
  document.body.classList.remove("modal-open");
  forgotNewPassword.value = "";
  forgotConfirmPassword.value = "";
  forgotCode.value = "";
}

async function invokeAccountSecurity(body) {
  const { data, error } = await supabase.functions.invoke("seguridad-cuenta", { body });
  if (error) throw error;
  if (!data?.ok) {
    const operationError = new Error(data?.error || "operacion_seguridad_fallida");
    operationError.userMessage = data?.message;
    throw operationError;
  }
  return data;
}

function validateNewPassword(value) {
  if (value.length < 10 || value.length > 72) {
    return "La contraseña debe tener entre 10 y 72 caracteres.";
  }
  if (!/[a-záéíóúñ]/i.test(value) || !/[0-9]/.test(value)) {
    return "La contraseña debe combinar letras y números.";
  }
  return "";
}

forgotPassword.addEventListener("click", event => {
  event.preventDefault();
  openRecoveryModal();
});

closeForgotModal.addEventListener("click", closeModal);
forgotBackBtn.addEventListener("click", () => setRecoveryStep("request"));

forgotRequestForm.addEventListener("submit", async event => {
  event.preventDefault();
  const numeroColaborador = forgotEmployeeNumber.value.trim();
  const correo = forgotEmail.value.trim().toLowerCase();

  if (!/^\d{1,20}$/.test(numeroColaborador)) {
    setRecoveryMessage("Ingresa un número de colaborador válido.", "error");
    return;
  }
  if (!forgotEmail.validity.valid || !correo) {
    setRecoveryMessage("Ingresa el correo personal registrado.", "error");
    return;
  }

  recoveryBusy = true;
  forgotRequestBtn.disabled = true;
  forgotRequestBtn.textContent = "Enviando…";
  setRecoveryMessage();

  try {
    const result = await invokeAccountSecurity({
      action: "request-reset",
      numero_colaborador: numeroColaborador,
      correo
    });
    setRecoveryStep("verify");
    setRecoveryMessage(result.message || "Si los datos coinciden, recibirás un código por correo.", "success");
  } catch (error) {
    console.error("No fue posible solicitar la recuperación.", error);
    setRecoveryMessage("No fue posible enviar el código. Intenta de nuevo más tarde.", "error");
  } finally {
    recoveryBusy = false;
    forgotRequestBtn.disabled = false;
    forgotRequestBtn.textContent = "Enviar código";
  }
});

forgotVerifyForm.addEventListener("submit", async event => {
  event.preventDefault();
  const code = forgotCode.value.trim();
  const newPassword = forgotNewPassword.value;
  const confirmation = forgotConfirmPassword.value;
  const passwordValidation = validateNewPassword(newPassword);

  if (!/^\d{5}$/.test(code)) {
    setRecoveryMessage("Ingresa el código completo de cinco dígitos.", "error");
    return;
  }
  if (passwordValidation) {
    setRecoveryMessage(passwordValidation, "error");
    return;
  }
  if (newPassword !== confirmation) {
    setRecoveryMessage("Las contraseñas no coinciden.", "error");
    return;
  }

  recoveryBusy = true;
  forgotVerifyBtn.disabled = true;
  forgotBackBtn.disabled = true;
  forgotVerifyBtn.textContent = "Actualizando…";
  setRecoveryMessage();

  try {
    const result = await invokeAccountSecurity({
      action: "verify-reset",
      numero_colaborador: forgotEmployeeNumber.value.trim(),
      correo: forgotEmail.value.trim().toLowerCase(),
      codigo: code,
      password: newPassword
    });
    loginMessage.textContent = "Contraseña actualizada. Ya puedes iniciar sesión.";
    loginMessage.className = "login-message success";
    setRecoveryMessage(
      result.email_warning
        ? "Contraseña actualizada. El correo de confirmación quedó registrado como pendiente."
        : "Contraseña actualizada. Enviamos una confirmación a tu correo.",
      "success"
    );
    password.value = "";
    setTimeout(() => {
      recoveryBusy = false;
      closeModal();
      password.focus();
    }, 1700);
  } catch (error) {
    console.error("No fue posible completar la recuperación.", error);
    setRecoveryMessage(error.userMessage || "El código no es válido o ya venció.", "error");
  } finally {
    if (!forgotModal.hidden) {
      recoveryBusy = false;
      forgotVerifyBtn.disabled = false;
      forgotBackBtn.disabled = false;
      forgotVerifyBtn.textContent = "Cambiar contraseña";
    }
  }
});

forgotModal.addEventListener("click", event => {
  if (event.target === forgotModal) {
    closeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !forgotModal.hidden && !recoveryBusy) {
    closeModal();
  }
});

function showLogin() {
  document.body.classList.remove("auth-pending");
  authBootstrapStatus.classList.add("is-leaving");
  setTimeout(() => {
    authBootstrapStatus.hidden = true;
  }, 520);
}

async function checkExistingSession() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user) {
      await showWelcomeAndRedirect(data.user);
      return;
    }

    if (error && error.name !== "AuthSessionMissingError") {
      console.error("No fue posible verificar la sesión actual.", error);
      loginMessage.textContent = "No fue posible verificar la sesión. Puedes intentar iniciar sesión.";
      loginMessage.classList.add("error");
    }
  } catch (error) {
    console.error("Error de conexión al verificar la sesión.", error);
    loginMessage.textContent = "No fue posible verificar la sesión. Puedes intentar iniciar sesión.";
    loginMessage.classList.add("error");
  }

  showLogin();
}

startCarousel();
checkExistingSession();
