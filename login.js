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

const forgotPassword = document.getElementById("forgotPassword");
const forgotModal = document.getElementById("forgotModal");
const closeForgotModal = document.getElementById("closeForgotModal");
const closeForgotAction = document.getElementById("closeForgotAction");

let currentSlide = 0;
let carouselTimer;

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
    const { error } = await supabase.auth.signInWithPassword({
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
    window.location.replace("/Landing/inventarios.html");
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

forgotPassword.addEventListener("click", event => {
  event.preventDefault();
  forgotModal.hidden = false;
});

function closeModal() {
  forgotModal.hidden = true;
}

closeForgotModal.addEventListener("click", closeModal);
closeForgotAction.addEventListener("click", closeModal);

forgotModal.addEventListener("click", event => {
  if (event.target === forgotModal) {
    closeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !forgotModal.hidden) {
    closeModal();
  }
});

function showLogin() {
  document.body.classList.remove("auth-pending");
  authBootstrapStatus.hidden = true;
}

async function checkExistingSession() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user) {
      window.location.replace("/Landing/inventarios.html");
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
