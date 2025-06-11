const container = document.getElementById('simulation-container');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
container.appendChild(labelRenderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const light = new THREE.PointLight(0xffffff, 1.5);
scene.add(light);

const bodyMeshes = {};
const orbitMeshes = [];
let bodiesData = [];
let timeScale = 0.01;

fetch('data/bodies.json')
    .then(res => res.json())
    .then(data => {
        bodiesData = data;
        populateBodies(data);
        animate();
    });

function createLabel(text) {
    const div = document.createElement('div');
    div.className = 'label';
    div.textContent = text;
    return new THREE.CSS2DObject(div);
}

function populateBodies(data) {
    const datalist = document.getElementById('bodies');
    data.forEach(body => {
        const option = document.createElement('option');
        option.value = body.id;
        datalist.appendChild(option);

        const radius = body.diameter / 7000;
        let material;
        if (body.texture) {
            const tex = new THREE.TextureLoader().load(body.texture);
            material = new THREE.MeshStandardMaterial({ map: tex });
        } else {
            material = new THREE.MeshStandardMaterial({ color: body.color || '#ffffff' });
        }
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), material);
        mesh.userData = body;
        mesh.userData.angle = Math.random() * Math.PI * 2;
        bodyMeshes[body.id] = mesh;
        scene.add(mesh);

        const label = createLabel(body.name);
        label.position.set(0, radius + 0.2, 0);
        mesh.add(label);

        if (body.distance > 0 && !body.parent) {
            const orbitGeo = new THREE.CircleGeometry(body.distance * 5, 64);
            orbitGeo.vertices.shift();
            const orbit = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: 0x555555 }));
            orbit.rotation.x = Math.PI / 2;
            orbit.userData.isOrbit = true;
            scene.add(orbit);
            orbitMeshes.push(orbit);
        }
    });
}

function updateBodies() {
    bodiesData.forEach(body => {
        const mesh = bodyMeshes[body.id];
        if (!mesh) return;
        if (body.distance > 0) {
            mesh.userData.angle += timeScale / body.orbitPeriod;
            const radius = body.distance * 5;
            let cx = 0,
                cz = 0;
            if (body.parent) {
                const parent = bodyMeshes[body.parent];
                if (parent) {
                    cx = parent.position.x;
                    cz = parent.position.z;
                }
            }
            mesh.position.set(
                cx + Math.cos(mesh.userData.angle) * radius,
                0,
                cz + Math.sin(mesh.userData.angle) * radius
            );
        }
        mesh.rotation.y += 0.01;
    });
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
window.addEventListener('click', onClick);
function onClick(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(Object.values(bodyMeshes));
    if (intersects.length > 0) {
        showInfo(intersects[0].object.userData);
    }
}

const infoPanel = document.getElementById('info-panel');
function showInfo(data) {
    infoPanel.innerHTML = `<strong>${data.name}</strong><br>
        Diameter: ${data.diameter} km<br>
        Orbital Period: ${data.orbitPeriod ? data.orbitPeriod + ' days' : '—'}<br>
        Distance from Sun: ${data.distance} AU<br>
        Gravity: ${data.gravity} m/s²<br>
        Composition: ${data.composition}<br>
        Moons: ${data.moons}<br>
        ${data.funFact}`;
    infoPanel.classList.remove('hidden');
}

document.getElementById('search').addEventListener('change', e => {
    const id = e.target.value.toLowerCase();
    const mesh = bodyMeshes[id];
    if (mesh) {
        controls.target.copy(mesh.position);
        controls.update();
    }
});

document.getElementById('toggle-orbits').addEventListener('change', e => {
    orbitMeshes.forEach(o => (o.visible = e.target.checked));
});
document.getElementById('toggle-labels').addEventListener('change', e => {
    Object.values(bodyMeshes).forEach(m => {
        if (m.children[0]) m.children[0].visible = e.target.checked;
    });
});

window.addEventListener('resize', onWindowResize);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    updateBodies();
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}
