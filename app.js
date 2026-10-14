const YOU = "You";
const storedGroups = JSON.parse(localStorage.getItem("paysplit-groups") || "[]");
const storedExpenses = JSON.parse(localStorage.getItem("paysplit-expenses") || "[]");
const state = { groups: Array.isArray(storedGroups) ? storedGroups : [], expenses: Array.isArray(storedExpenses) ? storedExpenses : [], pendingMembers: [] };
const $ = (selector) => document.querySelector(selector);
const activityList = $("#activity-list");
const expenseModal = $("#expense-modal");
const groupModal = $("#group-modal");
const expenseForm = $("#expense-form");
const groupForm = $("#group-form");
let editingGroupIndex = -1;

state.groups.forEach((group) => {
  group.members = group.members.map((member) => member === "Alex Morgan (you)" ? YOU : member);
});
state.expenses.forEach((expense) => {
  if (expense.paidBy === "Alex Morgan (you)") expense.paidBy = YOU;
});
save();

function money(value) { return `₹${Number(value || 0).toFixed(2)}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
function save() { localStorage.setItem("paysplit-groups", JSON.stringify(state.groups)); localStorage.setItem("paysplit-expenses", JSON.stringify(state.expenses)); }
function initials(name) { return name.replace(" (you)", "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function getGroup(name) { return state.groups.find((group) => group.name === name); }
function groupBalance(group) {
  const balances = Object.fromEntries(group.members.map((member) => [member, 0]));
  state.expenses.filter((expense) => expense.group === group.name).forEach((expense) => {
    if (!(expense.paidBy in balances)) balances[expense.paidBy] = 0;
    balances[expense.paidBy] += expense.amount;
    const share = expense.amount / group.members.length;
    group.members.forEach((member) => { balances[member] -= share; });
  });
  return balances;
}
function allBalances() {
  const balances = {};
  state.groups.forEach((group) => Object.entries(groupBalance(group)).forEach(([person, amount]) => { balances[person] = (balances[person] || 0) + amount; }));
  return balances;
}
function renderSummary() {
  const balances = allBalances();
  const own = balances[YOU] || 0;
  const youOwe = Object.entries(balances).filter(([person, amount]) => person !== YOU && amount > 0.005);
  const owedToYou = Object.entries(balances).filter(([person, amount]) => person !== YOU && amount < -0.005);
  $(".balance-card .status-pill").textContent = own >= 0 ? "You’re owed" : "You owe";
  $("#total-balance").textContent = `${own >= 0 ? "+" : "-"}${money(Math.abs(own))}`;
  $("#total-balance").style.color = own >= 0 ? "" : "#ffd7c5";
  $("#balance-note").textContent = `${state.groups.length} group${state.groups.length === 1 ? "" : "s"} · ${state.expenses.length} expense${state.expenses.length === 1 ? "" : "s"}`;
  $("#you-owe").textContent = money(youOwe.reduce((sum, [, amount]) => sum + amount, 0));
  $("#owed-to-you").textContent = money(owedToYou.reduce((sum, [, amount]) => sum + Math.abs(amount), 0));
  $("#owe-note").textContent = `to ${youOwe.length} people`;
  $("#owed-note").textContent = `from ${owedToYou.length} people`;
  renderPeople("#owe-people", youOwe);
  renderPeople("#owed-people", owedToYou);
  $("#you-owe-card").dataset.people = JSON.stringify(youOwe);
  $("#owed-to-you-card").dataset.people = JSON.stringify(owedToYou);
}
function renderPeople(selector, people) { $(selector).innerHTML = people.slice(0, 3).map(([person]) => `<span class="avatar avatar-small mint" title="${escapeHtml(person)}">${initials(person)}</span>`).join(""); }
function renderActivities() {
  if (!state.expenses.length) { activityList.innerHTML = `<div class="empty-state"><span>✦</span><strong>No expenses yet</strong><small>Add an expense after creating your first group.</small></div>`; return; }
  activityList.innerHTML = state.expenses.slice().reverse().slice(0, 6).map((expense) => {
    const group = getGroup(expense.group);
    const share = group ? expense.amount / group.members.length : expense.amount;
    const status = expense.paidBy === YOU ? "You paid" : `You owe ${money(share)}`;
    return `<div class="activity-row"><span class="activity-icon pink-bg">✦</span><div class="activity-copy"><strong>${escapeHtml(expense.description)}</strong><small>${escapeHtml(expense.group)} · ${escapeHtml(expense.paidBy)} paid</small></div><div class="activity-amount"><strong>${money(expense.amount)}</strong><small>${status}</small></div></div>`;
  }).join("");
}
function renderGroups() {
  const list = $("#group-list");
  if (!state.groups.length) { list.innerHTML = `<div class="empty-state compact"><span>＋</span><strong>No groups yet</strong><small>Create one to start splitting.</small></div>`; return; }
  list.innerHTML = state.groups.map((group) => {
    const balance = groupBalance(group)[YOU] || 0;
    return `<button class="group-row" data-group-index="${state.groups.indexOf(group)}"><span class="group-emoji home">✦</span><span class="group-info"><strong>${escapeHtml(group.name)}</strong><small>${group.members.length} members · ${state.expenses.filter((expense) => expense.group === group.name).length} expenses</small></span><span class="group-amount ${balance >= 0 ? "positive-text" : "negative-text"}">${balance >= 0 ? "+" : "-"}${money(Math.abs(balance))}</span><span class="chevron">›</span></button>`;
  }).join("");
}
function renderSettlements() {
  const rows = [];
  state.groups.forEach((group) => {
    const balances = groupBalance(group);
    const creditors = Object.entries(balances).filter(([, value]) => value > 0.005).map(([person, value]) => ({ person, value }));
    const debtors = Object.entries(balances).filter(([, value]) => value < -0.005).map(([person, value]) => ({ person, value: Math.abs(value) }));
    debtors.forEach((debtor) => creditors.forEach((creditor) => { const amount = Math.min(debtor.value, creditor.value); if (amount > 0.005) { rows.push(`<div class="settlement-row"><span class="avatar avatar-small mint">${initials(debtor.person)}</span><strong>${escapeHtml(debtor.person.replace(" (you)", " (you)"))}</strong><span class="settlement-arrow">→</span><span class="avatar avatar-small peach">${initials(creditor.person)}</span><strong>${escapeHtml(creditor.person)}</strong><b>${money(amount)}</b><small>${escapeHtml(group.name)}</small></div>`); debtor.value -= amount; creditor.value -= amount; } })); 
  });
  $("#settlement-panel").innerHTML = `<div class="section-heading"><div><h2>Settlement details</h2><p>Calculated from all equal splits</p></div></div>${rows.length ? rows.join("") : `<div class="empty-state"><span>✓</span><strong>All settled up</strong><small>Add groups and expenses to see balances here.</small></div>`}`;
}
function showBalanceDetails(title, people, direction) {
  const details = people.map(([person, amount]) => {
    const value = Math.abs(amount);
    return `<div class="settlement-row"><span class="avatar avatar-small ${direction === "owe" ? "coral" : "mint"}">${initials(person)}</span><strong>${escapeHtml(person)}</strong><span class="settlement-arrow">${direction === "owe" ? "→" : "←"}</span><b>${money(value)}</b><small>${direction === "owe" ? "you pay" : "you receive"}</small></div>`;
  }).join("");
  $("#settlement-panel").innerHTML = `<div class="section-heading"><div><h2>${title}</h2><p>Calculated from all equal splits</p></div></div>${details || `<div class="empty-state"><span>✓</span><strong>Nothing to settle</strong><small>No outstanding balances in your groups.</small></div>`}`;
  $("#settlement-panel").style.display = "block";
  $("#settlement-panel").scrollIntoView({ behavior: "smooth", block: "center" });
}
function populateExpenseForm() {
  const groupSelect = $("#expense-group");
  groupSelect.innerHTML = state.groups.map((group) => `<option value="${escapeHtml(group.name)}">${escapeHtml(group.name)}</option>`).join("");
  const group = getGroup(groupSelect.value);
  $("#expense-paid-by").innerHTML = group ? group.members.map((member) => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`).join("") : "";
  $("#split-members").textContent = group ? group.members.join(", ") : "Create a group first";
  updatePerPerson();
}
function updatePerPerson() { const group = getGroup($("#expense-group").value); $("#per-person").textContent = `${money((Number(expenseForm.elements.amount.value) || 0) / (group ? group.members.length : 1))} each`; }
function openModal(modal) { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); }
function closeModal(modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2800); }
function render() { renderSummary(); renderActivities(); renderGroups(); renderSettlements(); }

$(".add-expense-button").addEventListener("click", () => { if (!state.groups.length) { showToast("Create a group before adding an expense."); openModal(groupModal); return; } populateExpenseForm(); openModal(expenseModal); });
$("#create-group-button").addEventListener("click", () => { resetGroupModal(); openModal(groupModal); });
$(".round-add").addEventListener("click", () => $("#create-group-button").click());
$("#group-list").addEventListener("click", (event) => {
  const row = event.target.closest("[data-group-index]");
  if (!row) return;
  openGroupEditor(Number(row.dataset.groupIndex));
});
document.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", () => { const backdrop = button.closest(".modal-backdrop"); if (backdrop === groupModal) resetGroupModal(); closeModal(backdrop); }));
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => { if (event.target === backdrop) { if (backdrop === groupModal) resetGroupModal(); closeModal(backdrop); } }));
$("#add-member").addEventListener("click", addMember);
$("#member-name").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addMember(); } });
function addMember() { const input = $("#member-name"); const name = input.value.trim(); if (name && name !== YOU && !state.pendingMembers.includes(name)) state.pendingMembers.push(name); input.value = ""; renderMemberChips(); input.focus(); }
function renderMemberChips() { $("#member-chips").innerHTML = [`${YOU}`, ...state.pendingMembers].map((member, index) => `<span class="member-chip">${escapeHtml(member)}${index ? `<button type="button" data-remove-member="${index - 1}">×</button>` : ""}</span>`).join(""); document.querySelectorAll("[data-remove-member]").forEach((button) => button.addEventListener("click", () => { state.pendingMembers.splice(Number(button.dataset.removeMember), 1); renderMemberChips(); })); }
function openGroupEditor(index) {
  editingGroupIndex = index;
  const group = state.groups[index];
  state.pendingMembers = group.members.filter((member) => member !== YOU);
  groupForm.elements.name.value = group.name;
  $("#group-modal-title").textContent = "Edit your group";
  $("#group-modal-description").textContent = "Update the group name or manage its members.";
  $("#group-submit-button").innerHTML = "Save changes <span>→</span>";
  $("#delete-group-button").hidden = false;
  renderMemberChips();
  openModal(groupModal);
}
function resetGroupModal() {
  editingGroupIndex = -1;
  groupForm.reset();
  state.pendingMembers = [];
  $("#group-modal-title").textContent = "Who are you splitting with?";
  $("#group-modal-description").textContent = "Create a group and add everyone who shares expenses.";
  $("#group-submit-button").innerHTML = "Create group <span>→</span>";
  $("#delete-group-button").hidden = true;
  renderMemberChips();
}
groupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.pendingMembers.length) { showToast("Add at least one other member."); return; }
  const name = groupForm.elements.name.value.trim();
  const duplicate = state.groups.some((group, index) => index !== editingGroupIndex && group.name.toLowerCase() === name.toLowerCase());
  if (duplicate) { showToast("A group with that name already exists."); return; }
  if (editingGroupIndex >= 0) {
    const oldName = state.groups[editingGroupIndex].name;
    state.groups[editingGroupIndex] = { name, members: [YOU, ...state.pendingMembers] };
    state.expenses.forEach((expense) => { if (expense.group === oldName) expense.group = name; });
    showToast("Group updated.");
  } else {
    state.groups.push({ name, members: [YOU, ...state.pendingMembers] });
    showToast("Group created.");
  }
  save(); resetGroupModal(); closeModal(groupModal); render();
});
$("#delete-group-button").addEventListener("click", () => {
  if (editingGroupIndex < 0) return;
  const group = state.groups[editingGroupIndex];
  if (!window.confirm(`Delete "${group.name}" and its expenses?`)) return;
  state.groups.splice(editingGroupIndex, 1);
  state.expenses = state.expenses.filter((expense) => expense.group !== group.name);
  save(); resetGroupModal(); closeModal(groupModal); render(); showToast("Group deleted.");
});
$("#expense-group").addEventListener("change", populateExpenseForm);
expenseForm.elements.amount.addEventListener("input", updatePerPerson);
expenseForm.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(expenseForm); state.expenses.push({ description: data.get("description"), amount: Number(data.get("amount")), group: data.get("group"), paidBy: data.get("paidBy") }); save(); expenseForm.reset(); closeModal(expenseModal); render(); showToast("Expense added and balances updated."); });
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.view === "expenses") $(".activity-panel").scrollIntoView({ behavior: "smooth" }); if (button.dataset.view === "settle") $("#settlement-panel").scrollIntoView({ behavior: "smooth", block: "center" }); }));
function bindBalanceCard(cardSelector, title, direction) {
  const card = $(cardSelector);
  const open = () => showBalanceDetails(title, JSON.parse(card.dataset.people || "[]"), direction);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
}
bindBalanceCard("#you-owe-card", "People you owe", "owe");
bindBalanceCard("#owed-to-you-card", "People who owe you", "owed");
document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.querySelectorAll(".modal-backdrop.open").forEach(closeModal); });
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
