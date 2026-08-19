const SHEET_URL = "https://opensheet.elk.sh/1zNL8jxRxy7z4h_V7iL-uxejIDUdFgYP0G_tqf5G1Fcg/Data%20Siswa";

function showError(message) {
    const table = document.getElementById("data-table");
    table.replaceChildren();
    const caption = document.createElement("caption");
    caption.textContent = message;
    table.appendChild(caption);
}

function render(rows) {
    const headRow = document.getElementById("table-head");
    const bodyTable = document.getElementById("table-body");

    Object.keys(rows[0]).forEach(key => {
        const th = document.createElement("th");
        th.textContent = String(key);
        headRow.appendChild(th);
    });

    rows.forEach(row => {
        const tr = document.createElement("tr");
        Object.values(row).forEach(cell => {
            const td = document.createElement("td");
            td.textContent = cell === null || cell === undefined ? "" : String(cell);
            tr.appendChild(td);
        });
        bodyTable.appendChild(tr);
    });
}

fetch(SHEET_URL, { credentials: "omit", referrerPolicy: "no-referrer" })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data) || !data.length) {
            showError("Data tidak tersedia.");
            return;
        }
        render(data);
    })
    .catch(err => {
        showError("Gagal memuat data.");
        console.error(err);
    });
