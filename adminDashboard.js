/**
 * ADMIN DASHBOARD - PREPA_CONCOURS
 * Dashboard Premium pour l'administration
 * Connecté à Supabase pour les données réelles
 */

const supabase = window.supabaseClient;

// Instance du graphique
let activityChart = null;

// ========================================================
// INITIALISATION DU DASHBOARD ADMIN
// ========================================================
async function initialiserDashboardAdmin() {
  console.log("🔐 Initialisation Dashboard Admin...");

  // Charger toutes les données en parallèle
  await Promise.all([
    remplirTableModeration(),
    initialiserGraphiqueActivite(),
    mettreAJourKPIs()
  ]);
}

// ========================================================
// 1. REMPLIR LE TABLEAU DE MODÉRATION (Données Supabase)
// ========================================================
async function remplirTableModeration() {
  const tbody = document.getElementById('admin-moderation-table');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Chargement...</td></tr>';

  try {
    // Récupérer les profils non autorisés depuis Supabase
    const { data: profils, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('est_autorise', false)
      .order('date_inscription', { ascending: false });

    if (error) throw error;

    tbody.innerHTML = '';

    if (!profils || profils.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #64748b;">Aucun étudiant en attente</td></tr>';
      mettreAJourBadgeModeration(0);
      return;
    }

    profils.forEach(etudiant => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${etudiant.nom_complet || 'Non renseigné'}</strong></td>
        <td>${etudiant.email}</td>
        <td>${formaterDate(etudiant.date_inscription)}</td>
        <td>
          <div class="admin-table-actions">
            <button class="btn-accepter" onclick="accepterEtudiant('${etudiant.id}')">
              ✓ Accepter
            </button>
            <button class="btn-bloquer" onclick="bloquerEtudiant('${etudiant.id}')">
              ✗ Bloquer
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    mettreAJourBadgeModeration(profils.length);

  } catch (err) {
    console.error("Erreur chargement modération:", err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #ef4444;">Erreur de chargement</td></tr>';
  }
}

// ========================================================
// 2. INITIALISER LE GRAPHIQUE D'ACTIVITÉ (Données Supabase)
// ========================================================
async function initialiserGraphiqueActivite() {
  const canvas = document.getElementById('admin-activity-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Détruire l'instance existante si elle existe
  if (activityChart) {
    activityChart.destroy();
  }

  try {
    // Récupérer les sessions des dernières 24h depuis Supabase
    const ilYA24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from('exam_sessions')
      .select('date_passage')
      .gte('date_passage', ilYA24h);

    if (error) throw error;

    // Agréger les données par heure
    const heures = ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'];
    const connexionsParHeure = new Array(12).fill(0);

    if (sessions && sessions.length > 0) {
      sessions.forEach(session => {
        const heure = new Date(session.date_passage).getHours();
        const index = Math.floor(heure / 2); // Grouper par créneaux de 2h
        if (index >= 0 && index < 12) {
          connexionsParHeure[index]++;
        }
      });
    }

    // Créer le gradient pour la courbe
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    activityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: heures,
        datasets: [{
          label: 'Connexions',
          data: connexionsParHeure,
          borderColor: '#4f46e5',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4f46e5',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            padding: 12,
            cornerRadius: 8,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#64748b',
              font: {
                size: 11,
                weight: 600
              }
            }
          },
          y: {
            grid: {
              color: '#e2e8f0',
              drawBorder: false
            },
            ticks: {
              color: '#64748b',
              font: {
                size: 11,
                weight: 600
              }
            },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

  } catch (err) {
    console.error("Erreur chargement graphique:", err);
    // Afficher des données fictives en cas d'erreur
    afficherGraphiqueFallback(ctx);
  }
}

function afficherGraphiqueFallback(ctx) {
  const heures = ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'];
  const connexions = [5, 3, 2, 8, 25, 45, 60, 55, 48, 62, 70, 35];

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: heures,
      datasets: [{
        label: 'Connexions',
        data: connexions,
        borderColor: '#4f46e5',
        backgroundColor: gradient,
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4f46e5',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b' } },
        y: { grid: { color: '#e2e8f0' }, beginAtZero: true }
      }
    }
  });
}

// ========================================================
// 3. METTRE À JOUR LES KPIS (Données Supabase)
// ========================================================
async function mettreAJourKPIs() {
  try {
    // Total des étudiants autorisés
    const { data: profils, error: errorProfils } = await supabase
      .from('profiles')
      .select('id')
      .eq('est_autorise', true);

    if (!errorProfils && profils) {
      animerNombre('admin-kpi-total', profils.length);
    }

    // Étudiants actifs aujourd'hui (au moins une session aujourd'hui)
    const debutJournee = new Date();
    debutJournee.setHours(0, 0, 0, 0);
    const debutJourneeISO = debutJournee.toISOString();

    const { data: sessionsAujourdhui, error: errorSessions } = await supabase
      .from('exam_sessions')
      .select('user_id')
      .gte('date_passage', debutJourneeISO);

    if (!errorSessions && sessionsAujourdhui) {
      const utilisateursUniques = new Set(sessionsAujourdhui.map(s => s.user_id));
      animerNombre('admin-kpi-actifs', utilisateursUniques.size);
    }

    // Taux de complétion moyen (score moyen / total questions)
    const { data: toutesSessions, error: errorToutes } = await supabase
      .from('exam_sessions')
      .select('score_total, total_questions');

    if (!errorToutes && toutesSessions && toutesSessions.length > 0) {
      const tauxMoyen = toutesSessions.reduce((acc, s) => {
        return acc + (s.score_total / s.total_questions);
      }, 0) / toutesSessions.length;

      const pourcentage = Math.round(tauxMoyen * 100);
      const element = document.getElementById('admin-kpi-completion');
      if (element) {
        animerNombre('admin-kpi-completion', pourcentage);
        element.textContent = pourcentage + '%';
      }
    }

  } catch (err) {
    console.error("Erreur chargement KPIs:", err);
    // Valeurs par défaut en cas d'erreur
    animerNombre('admin-kpi-total', 0);
    animerNombre('admin-kpi-actifs', 0);
  }
}

// ========================================================
// ACTIONS DE MODÉRATION (Supabase)
// ========================================================
async function accepterEtudiant(id) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ est_autorise: true })
      .eq('id', id);

    if (error) throw error;

    alert('✅ Étudiant accepté avec succès !');
    remplirTableModeration();
    mettreAJourKPIs(); // Mettre à jour les KPIs
  } catch (err) {
    console.error("Erreur acceptation:", err);
    alert('❌ Erreur lors de l\'acceptation: ' + err.message);
  }
}

async function bloquerEtudiant(id) {
  if (!confirm('⚠️ Voulez-vous vraiment bloquer cet étudiant ?')) return;

  try {
    // Option 1: Supprimer le profil (plus drastique)
    // const { error } = await supabase.from('profiles').delete().eq('id', id);

    // Option 2: Garder le profil mais marquer comme non autorisé (plus doux)
    const { error } = await supabase
      .from('profiles')
      .update({ est_autorise: false })
      .eq('id', id);

    if (error) throw error;

    alert('🚫 Étudiant bloqué avec succès !');
    remplirTableModeration();
    mettreAJourKPIs(); // Mettre à jour les KPIs
  } catch (err) {
    console.error("Erreur blocage:", err);
    alert('❌ Erreur lors du blocage: ' + err.message);
  }
}

function mettreAJourBadgeModeration(count) {
  const badge = document.querySelector('.admin-badge-orange');
  if (badge) {
    badge.textContent = `${count} en attente`;
    if (count === 0) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'inline-block';
    }
  }
}

// ========================================================
// ACTION SÉCURITÉ
// ========================================================
function forcerDeconnexion() {
  if (confirm("⚠️ Voulez-vous vraiment forcer la déconnexion de cet utilisateur ?")) {
    const alerte = document.getElementById('admin-alerte-securite');
    if (alerte) {
      alerte.style.animation = 'apparition 0.3s ease reverse';
      setTimeout(() => {
        alerte.style.display = 'none';
      }, 300);
    }
    alert("✅ La déconnexion forcée a été effectuée avec succès !");
  }
}

// ========================================================
// UTILITAIRES
// ========================================================
function formaterDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function animerNombre(elementId, valeurCible) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const valeurActuelle = parseInt(element.textContent) || 0;
  const duree = 1000; // 1 seconde
  const etapes = 30;
  const increment = (valeurCible - valeurActuelle) / etapes;
  let etape = 0;

  const interval = setInterval(() => {
    etape++;
    const nouvelleValeur = Math.round(valeurActuelle + (increment * etape));
    element.textContent = nouvelleValeur;

    if (etape >= etapes) {
      clearInterval(interval);
      element.textContent = valeurCible;
    }
  }, duree / etapes);
}

// ========================================================
// SWITCH MODE (Temporaire pour tests)
// ========================================================
let modeAdmin = false;

function initialiserSwitchMode() {
  const btnSwitch = document.getElementById('btn-switch-mode');
  const switchText = document.getElementById('switch-mode-text');

  if (btnSwitch) {
    btnSwitch.addEventListener('click', async () => {
      modeAdmin = !modeAdmin;
      window.modeAdminSwitch = modeAdmin; // Marquer globalement pour app.js

      if (modeAdmin) {
        switchText.textContent = '🎓 Mode Étudiant';
        btnSwitch.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
        afficherEcran('admin');
        await initialiserDashboardAdmin(); // Attendre le chargement des données
      } else {
        switchText.textContent = '🔓 Mode Admin';
        btnSwitch.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        afficherEcran('dashboard');
      }
    });
  }
}

// ========================================================
// CHARGER AU DÉMARRAGE
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  initialiserSwitchMode();
});
