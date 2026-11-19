/**
 * Composite Procedural 3D Passengers & Props (Mom, Dad, 4 Other Passengers + Extra Anomaly Passenger).
 * Every figure is built as a multi-part THREE.Group (8-12+ parts) with varied roughness/metalness
 * and grounded pivots. No passenger looks at the camera except Mom/Dad during stare events.
 */

import * as THREE from 'three';
import { AnomalyTargetId } from '../game/anomalies';

export interface PassengerRig {
  momGroup: THREE.Group;
  momHead: THREE.Group;
  dadGroup: THREE.Group;
  dadHead: THREE.Group;
  otherPassengersGroup: THREE.Group;
  extraPassengerGroup: THREE.Group;
  umbrellaGroup: THREE.Group;
  interactables: THREE.Object3D[];
}

function tagInteractable(obj: THREE.Object3D, targetId: AnomalyTargetId): void {
  obj.userData.targetId = targetId;
  obj.traverse((child) => {
    child.userData.targetId = targetId;
  });
}

function createSeatedHuman(options: {
  coatColor: number;
  pantsColor: number;
  skinColor: number;
  hairColor: number;
  coatRoughness?: number;
  armPose: 'folded_lap' | 'arm_on_bench' | 'holding_paper' | 'slouched_lap' | 'side_rest';
  headPitch?: number;
  headYaw?: number;
  closedEyes?: boolean;
  hasHeadphones?: boolean;
  buttonedUp?: boolean;
}): { group: THREE.Group; headGroup: THREE.Group } {
  const group = new THREE.Group();

  const coatMat = new THREE.MeshStandardMaterial({
    color: options.coatColor,
    roughness: options.coatRoughness ?? 0.84,
    metalness: 0.04,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: options.pantsColor,
    roughness: 0.88,
    metalness: 0.02,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: options.skinColor,
    roughness: 0.62,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: options.hairColor,
    roughness: 0.9,
    metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d1e,
    roughness: 0.35,
    metalness: 0.12,
  });

  // Lower legs (planted on floor Y = 0)
  const shinGeo = new THREE.CylinderGeometry(0.058, 0.05, 0.43, 10);
  const leftShin = new THREE.Mesh(shinGeo, pantsMat);
  leftShin.position.set(-0.11, 0.22, 0.28);
  const rightShin = new THREE.Mesh(shinGeo, pantsMat);
  rightShin.position.set(0.11, 0.22, 0.28);
  group.add(leftShin, rightShin);

  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.1, 0.07, 0.22);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.11, 0.035, 0.34);
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.11, 0.035, 0.34);
  group.add(leftShoe, rightShoe);

  // Thighs resting on bench (bench seat Y ≈ 0.46)
  const thighGeo = new THREE.CylinderGeometry(0.078, 0.068, 0.42, 10);
  thighGeo.rotateX(Math.PI / 2);
  const leftThigh = new THREE.Mesh(thighGeo, pantsMat);
  leftThigh.position.set(-0.11, 0.49, 0.12);
  const rightThigh = new THREE.Mesh(thighGeo, pantsMat);
  rightThigh.position.set(0.11, 0.49, 0.12);
  group.add(leftThigh, rightThigh);

  // Pelvis / coat skirt
  const hipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.28), coatMat);
  hipMesh.position.set(0, 0.52, -0.04);
  group.add(hipMesh);

  // Torso (upright coat)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.22), coatMat);
  torso.position.set(0, 0.84, -0.06);
  torso.castShadow = true;
  group.add(torso);

  // Shoulders rounded cap
  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 10), coatMat);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.set(0, 1.07, -0.06);
  group.add(shoulders);

  // Coat collar & buttons if buttoned to the top
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.09, 12), coatMat);
  collar.position.set(0, 1.13, -0.05);
  group.add(collar);

  if (options.buttonedUp) {
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0x222425,
      roughness: 0.28,
      metalness: 0.45,
    });
    const btnGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8);
    btnGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.position.set(0, 0.68 + i * 0.11, 0.056);
      group.add(btn);
    }
  }

  // Arms by pose
  const armGeo = new THREE.CylinderGeometry(0.052, 0.046, 0.34, 10);
  const forearmGeo = new THREE.CylinderGeometry(0.044, 0.038, 0.28, 10);
  const handGeo = new THREE.SphereGeometry(0.042, 10, 8);

  const leftUpper = new THREE.Mesh(armGeo, coatMat);
  const rightUpper = new THREE.Mesh(armGeo, coatMat);
  const leftFore = new THREE.Mesh(forearmGeo, coatMat);
  const rightFore = new THREE.Mesh(forearmGeo, coatMat);
  const leftHand = new THREE.Mesh(handGeo, skinMat);
  const rightHand = new THREE.Mesh(handGeo, skinMat);

  if (options.armPose === 'folded_lap') {
    // Mom: hands neatly folded in lap
    leftUpper.position.set(-0.22, 0.9, -0.02);
    leftUpper.rotation.set(0.22, 0, 0.12);
    rightUpper.position.set(0.22, 0.9, -0.02);
    rightUpper.rotation.set(0.22, 0, -0.12);

    leftFore.position.set(-0.11, 0.64, 0.13);
    leftFore.rotation.set(Math.PI / 2 - 0.15, 0, -0.65);
    rightFore.position.set(0.11, 0.64, 0.13);
    rightFore.rotation.set(Math.PI / 2 - 0.15, 0, 0.65);

    leftHand.position.set(-0.02, 0.6, 0.2);
    rightHand.position.set(0.03, 0.61, 0.21);
  } else if (options.armPose === 'arm_on_bench') {
    // Dad: one arm along the back of the bench, other resting on knee
    leftUpper.position.set(-0.25, 1.03, -0.1);
    leftUpper.rotation.set(0, 0, Math.PI / 2 - 0.18);
    leftFore.position.set(-0.46, 1.05, -0.12);
    leftFore.rotation.set(0, 0, Math.PI / 2);
    leftHand.position.set(-0.6, 1.04, -0.11);

    rightUpper.position.set(0.23, 0.88, -0.01);
    rightUpper.rotation.set(0.28, 0, -0.1);
    rightFore.position.set(0.21, 0.65, 0.15);
    rightFore.rotation.set(Math.PI / 2 - 0.2, 0, 0.15);
    rightHand.position.set(0.16, 0.56, 0.25);
  } else if (options.armPose === 'holding_paper') {
    // Gray suit man holding open blank white newspaper
    leftUpper.position.set(-0.22, 0.88, 0.04);
    leftUpper.rotation.set(0.65, 0, 0.12);
    rightUpper.position.set(0.22, 0.88, 0.04);
    rightUpper.rotation.set(0.65, 0, -0.12);

    leftFore.position.set(-0.2, 0.78, 0.25);
    leftFore.rotation.set(Math.PI / 2 - 0.35, 0, -0.1);
    rightFore.position.set(0.2, 0.78, 0.25);
    rightFore.rotation.set(Math.PI / 2 - 0.35, 0, 0.1);

    leftHand.position.set(-0.2, 0.82, 0.36);
    rightHand.position.set(0.2, 0.82, 0.36);
  } else {
    leftUpper.position.set(-0.22, 0.88, -0.02);
    leftUpper.rotation.set(0.25, 0, 0.08);
    rightUpper.position.set(0.22, 0.88, -0.02);
    rightUpper.rotation.set(0.25, 0, -0.08);

    leftFore.position.set(-0.18, 0.63, 0.14);
    leftFore.rotation.set(Math.PI / 2 - 0.2, 0, -0.2);
    rightFore.position.set(0.18, 0.63, 0.14);
    rightFore.rotation.set(Math.PI / 2 - 0.2, 0, 0.2);

    leftHand.position.set(-0.14, 0.57, 0.24);
    rightHand.position.set(0.14, 0.57, 0.24);
  }

  group.add(leftUpper, rightUpper, leftFore, rightFore, leftHand, rightHand);

  // Neck + Head Group (pivoted at neck base for realistic look turns)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.15, -0.05);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.1, 10), skinMat);
  neck.position.set(0, 0.04, 0);
  headGroup.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 14), skinMat);
  cranium.scale.set(0.92, 1.08, 0.98);
  cranium.position.set(0, 0.17, 0.01);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.123, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hair.scale.set(0.95, 1.06, 1.02);
  hair.position.set(0, 0.185, -0.005);
  headGroup.add(hair);

  // Subtle nose bridge
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.042, 6), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.16, 0.125);
  headGroup.add(nose);

  // Eyes (either open realistic dark irises or closed lids for teenager)
  if (options.closedEyes) {
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x3b2f28, roughness: 0.8 });
    const lidGeo = new THREE.BoxGeometry(0.032, 0.007, 0.01);
    const lLid = new THREE.Mesh(lidGeo, lidMat);
    lLid.position.set(-0.04, 0.18, 0.112);
    const rLid = new THREE.Mesh(lidGeo, lidMat);
    rLid.position.set(0.04, 0.18, 0.112);
    headGroup.add(lLid, rLid);
  } else {
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xebeae4, roughness: 0.25 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.15 });
    const eyeGeo = new THREE.SphereGeometry(0.014, 8, 8);
    const pupilGeo = new THREE.SphereGeometry(0.007, 8, 8);

    [-0.038, 0.038].forEach((ex) => {
      const eye = new THREE.Mesh(eyeGeo, scleraMat);
      eye.position.set(ex, 0.182, 0.106);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(ex, 0.182, 0.116);
      headGroup.add(eye, pupil);
    });
  }

  // Over-ear headphones for Teenager
  if (options.hasHeadphones) {
    const hpMat = new THREE.MeshStandardMaterial({
      color: 0x202428,
      roughness: 0.35,
      metalness: 0.55,
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.014, 8, 18, Math.PI), hpMat);
    band.position.set(0, 0.19, 0.005);
    const cupGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.03, 12);
    cupGeo.rotateZ(Math.PI / 2);
    const lCup = new THREE.Mesh(cupGeo, hpMat);
    lCup.position.set(-0.12, 0.17, 0.005);
    const rCup = new THREE.Mesh(cupGeo, hpMat);
    rCup.position.set(0.12, 0.17, 0.005);
    headGroup.add(band, lCup, rCup);
  }

  headGroup.rotation.set(options.headPitch ?? 0, options.headYaw ?? 0, 0);
  group.add(headGroup);

  return { group, headGroup };
}

export function buildPassengers(blankNewspaperTexture: THREE.CanvasTexture): PassengerRig {
  const interactables: THREE.Object3D[] = [];

  // 1. MOM — Left bench (X = -0.96, facing right +X into car), upright, buttoned coat, hands folded
  const mom = createSeatedHuman({
    coatColor: 0x364442,
    pantsColor: 0x23272a,
    skinColor: 0xd9b39c,
    hairColor: 0x2b211c,
    armPose: 'folded_lap',
    buttonedUp: true,
  });
  mom.group.position.set(-0.96, 0, 0.92);
  mom.group.rotation.y = Math.PI / 2; // Facing straight across the aisle
  tagInteractable(mom.group, 'mom_face');
  interactables.push(mom.group);

  // 2. DAD — Left bench beside Mom (X = -0.96, Z = 1.56), one arm along bench back, watching player
  const dad = createSeatedHuman({
    coatColor: 0x4b3f35,
    pantsColor: 0x2a2f35,
    skinColor: 0xd1a88e,
    hairColor: 0x382e29,
    armPose: 'arm_on_bench',
    headYaw: -0.52, // Watching player seat
  });
  dad.group.position.set(-0.96, 0, 1.56);
  dad.group.rotation.y = Math.PI / 2;
  tagInteractable(dad.group, 'dad_face');
  interactables.push(dad.group);

  // Container for the 4 other passengers down the car (vanishes on 'car_goes_empty')
  const otherPassengersGroup = new THREE.Group();

  // 3. Gray suit man reading blank white newspaper (right bench, further down car)
  const suitMan = createSeatedHuman({
    coatColor: 0x565c62,
    pantsColor: 0x464b51,
    skinColor: 0xd6b49d,
    hairColor: 0x454545,
    armPose: 'holding_paper',
    headPitch: 0.36, // Looking down into the blank paper
  });
  // Open folded blank newspaper (2 angled pages)
  const paperMat = new THREE.MeshStandardMaterial({
    map: blankNewspaperTexture,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const leftPage = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.34), paperMat);
  leftPage.position.set(-0.11, 0.88, 0.38);
  leftPage.rotation.set(-0.35, 0.24, 0);
  const rightPage = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.34), paperMat);
  rightPage.position.set(0.11, 0.88, 0.38);
  rightPage.rotation.set(-0.35, -0.24, 0);
  suitMan.group.add(leftPage, rightPage);
  suitMan.group.position.set(0.96, 0, -1.95);
  suitMan.group.rotation.y = -Math.PI / 2;
  otherPassengersGroup.add(suitMan.group);

  // 4. Woman with a grocery bag facing AWAY toward the dark window glass (left bench, mid-far)
  const groceryWoman = createSeatedHuman({
    coatColor: 0x6b4d52,
    pantsColor: 0x262930,
    skinColor: 0xc5977c,
    hairColor: 0x1c1715,
    armPose: 'side_rest',
    headYaw: 1.35, // Turned sharply away toward the left window glass (away from camera)
    headPitch: 0.08,
  });
  // Brown kraft paper grocery bag resting beside her on the bench
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x9e7750, roughness: 0.92 });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.18), bagMat);
  bag.position.set(0.32, 0.63, 0.02);
  const bagRim = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.04, 0.19),
    new THREE.MeshStandardMaterial({ color: 0x876442, roughness: 0.95 }),
  );
  bagRim.position.set(0.32, 0.81, 0.02);
  groceryWoman.group.add(bag, bagRim);
  groceryWoman.group.position.set(-0.96, 0, -2.95);
  // Angled slightly back toward the window glass so she genuinely faces away from the aisle
  groceryWoman.group.rotation.y = Math.PI * 0.78;
  otherPassengersGroup.add(groceryWoman.group);

  // 5. Teenager with headphones and closed eyes (right bench, far end)
  const teen = createSeatedHuman({
    coatColor: 0x2d3a4b,
    pantsColor: 0x23272c,
    skinColor: 0xd0a78a,
    hairColor: 0x18181a,
    armPose: 'slouched_lap',
    headPitch: 0.32,
    closedEyes: true,
    hasHeadphones: true,
  });
  teen.group.position.set(0.96, 0, -4.65);
  teen.group.rotation.y = -Math.PI / 2;
  otherPassengersGroup.add(teen.group);

  tagInteractable(otherPassengersGroup, 'car_passengers');
  interactables.push(otherPassengersGroup);

  // 6. Empty seat with forgotten black umbrella leaning against it (left bench, far end)
  const umbrellaGroup = new THREE.Group();
  const nylonMat = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.62, metalness: 0.08 });
  const metalTipMat = new THREE.MeshStandardMaterial({ color: 0xbfc5c9, roughness: 0.25, metalness: 0.88 });
  const woodHandleMat = new THREE.MeshStandardMaterial({ color: 0x422a1b, roughness: 0.45, metalness: 0.05 });

  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.56, 10), nylonMat);
  canopy.position.set(0, 0.34, 0);
  canopy.rotation.x = Math.PI;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.009, 0.08, 8), metalTipMat);
  tip.position.set(0, 0.04, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), metalTipMat);
  shaft.position.set(0, 0.72, 0);
  const handleHook = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.011, 8, 14, Math.PI), woodHandleMat);
  handleHook.position.set(0.032, 0.83, 0);

  umbrellaGroup.add(canopy, tip, shaft, handleHook);
  umbrellaGroup.position.set(-0.76, 0, -4.4);
  umbrellaGroup.rotation.set(0.06, 0.2, 0.24); // Leaning naturally against the empty fiberglass seat
  tagInteractable(umbrellaGroup, 'umbrella_seat');
  interactables.push(umbrellaGroup);

  // 7. Extra anomalous passenger (hidden by default; appears in the empty umbrella seat on 'extra_passenger')
  const extraPassenger = createSeatedHuman({
    coatColor: 0x232629,
    pantsColor: 0x1a1c1e,
    skinColor: 0xc9b8aa,
    hairColor: 0x161616,
    armPose: 'folded_lap',
    headYaw: 0.25,
    buttonedUp: true,
  });
  extraPassenger.group.position.set(-0.96, 0, -4.4);
  extraPassenger.group.rotation.y = Math.PI / 2;
  extraPassenger.group.visible = false;
  tagInteractable(extraPassenger.group, 'extra_seat');
  interactables.push(extraPassenger.group);

  return {
    momGroup: mom.group,
    momHead: mom.headGroup,
    dadGroup: dad.group,
    dadHead: dad.headGroup,
    otherPassengersGroup,
    extraPassengerGroup: extraPassenger.group,
    umbrellaGroup,
    interactables,
  };
}
