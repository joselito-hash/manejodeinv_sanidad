const slides = [...document.querySelectorAll(".slide")];
const dots = [...document.querySelectorAll(".dot")];

const loginForm = document.getElementById("loginForm");
const employeeNumber = document.getElementById("employeeNumber");
const password = document.getElementById("password");
const employeeError = document.getElementById("employeeError");
const passwordError = document.getElementById("passwordError");
const togglePassword = document.getElementById("togglePassword");
const loginMessage = document.getElementById("loginMessage");

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

loginForm.addEventListener("submit", event => {
  event.preventDefault();

  if (!validateForm()) {
    loginMessage.textContent = "Revisa los datos ingresados.";
    loginMessage.classList.add("error");
    return;
  }

  // Front-end demo:
  // Aquí puedes reemplazar esta lógica por una petición a tu backend.
  loginMessage.textContent = "Acceso correcto. Redirigiendo...";
  loginMessage.classList.add("success");

  if (document.getElementById("rememberMe").checked) {
    localStorage.setItem(
      "bimboSanidadEmployee",
      employeeNumber.value.trim()
    );
  } else {
    localStorage.removeItem("bimboSanidadEmployee");
  }

  setTimeout(() => {
    window.location.href = "Landing/inventarios.html";
  }, 650);
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

startCarousel();
