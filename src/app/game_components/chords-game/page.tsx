"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { motion } from "framer-motion";
import InstructionsModal from "../instructions/page"; // Adjust the path as needed
import { useRouter } from "next/navigation";
const leftThreshold = 1800;
const rightThreshold = 2000;
import { EXGFilter, Notch } from './filters';


export default function Home() {
    const mountRef = useRef<HTMLDivElement>(null);
    const [cube, setCube] = useState<THREE.Mesh | null>(null);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [obstacles, setObstacles] = useState<THREE.Mesh[]>([]);
    const [highScore, setHighScore] = useState(0);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const [isGameRunning, setIsGameRunning] = useState(false);
    const [level, setLevel] = useState(1);
    const [powerUp, setPowerUp] = useState<THREE.Mesh | null>(null);
    const [powerUpTimer, setPowerUpTimer] = useState(0);
    const [gameSpeed, setGameSpeed] = useState(0.05);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [showInstructions, setShowInstructions] = useState(false);
    const [explosionTriggered, setExplosionTriggered] = useState(false);
    const [showCongrats, setShowCongrats] = useState(false);
    const [levelUpPaused, setLevelUpPaused] = useState(false);
    const [deviceConnected, setDeviceConnected] = useState(false);
    const router = useRouter();

    // A ref to hold the latest isGameRunning value for the serial loop.
    const isGameRunningRef = useRef(isGameRunning);
    useEffect(() => {
        isGameRunningRef.current = isGameRunning;
    }, [isGameRunning]);

    // Refs for serial port/reader and to control the read loop.
    const portRef = useRef<SerialPort | null>(null);
    const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
    const readLoopActiveRef = useRef<boolean>(false);


    useEffect(() => {
        // Create skybox texture
        const createSkyBox = () => {
            const loader = new THREE.CubeTextureLoader();
            const texture = loader.load([
                '/skybox/right.jpg',
                '/skybox/left.jpg',
                '/skybox/top.jpg',
                '/skybox/bottom.jpg',
                '/skybox/front.jpg',
                '/skybox/back.jpg',
            ]);
            return texture;
        };

        // Initialize the scene with a space-themed background
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0a1128");
        // Uncomment below line when you have skybox textures
        // scene.background = createSkyBox();
        sceneRef.current = scene;

        // Add fog for depth effect
        scene.fog = new THREE.Fog("#0a1128", 5, 15);

        // Set up camera with better positioning
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 3, 8);

        // Create renderer with enhanced settings
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // In newer Three.js versions, use outputColorSpace instead of outputEncoding
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        mountRef.current?.appendChild(renderer.domElement);

        // Add dynamic lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.far = 20;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        // Add point light for dramatic effect
        const pointLight = new THREE.PointLight(0x3677ff, 1, 10);
        pointLight.position.set(0, 2, 0);
        scene.add(pointLight);

        // Create playing field with grid and better materials
        const planeGeometry = new THREE.PlaneGeometry(20, 40);
        // Fallback to a nicer material if texture isn't available
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: "#131E3A",
            metalness: 0.3,
            roughness: 0.8,
            emissive: "#0a1128",
            emissiveIntensity: 0.2
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -1;
        plane.position.z = -10;
        plane.receiveShadow = true;
        scene.add(plane);

        // Grid helper for visual reference
        const gridHelper = new THREE.GridHelper(20, 20, 0x3677ff, 0x162447);
        gridHelper.position.y = -0.99;
        scene.add(gridHelper);

        // Create player cube with better materials
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshPhysicalMaterial({
            color: "#ff5733",
            metalness: 0.8,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            emissive: "#ff5733",
            emissiveIntensity: 0.8
        });

        const newCube = new THREE.Mesh(geometry, material);
        newCube.castShadow = true;
        newCube.receiveShadow = true;
        newCube.position.y = 0;
        scene.add(newCube);
        setCube(newCube);

        // Particle system for background effects
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 200;
        const posArray = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 20;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.05,
            color: 0xffffff,
        });

        const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particleSystem);

        // Camera controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2.5;

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);

            // Animate particle system
            particleSystem.rotation.y += 0.0005;

            // Animate player cube slightly
            if (newCube && !gameOver && isGameRunning) {

                newCube.rotation.y += 0.01;
                newCube.rotation.x += 0.005;
                newCube.scale.set(1, 1, 1);

            }

            // Animate power-up if it exists
            if (powerUp) {
                powerUp.rotation.y += 0.03;
                powerUp.rotation.x += 0.02;

                // Make it hover up and down
                powerUp.position.y = 0.5 + 0.2 * Math.sin(Date.now() * 0.003);
            }

            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        // Handle window resize
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            mountRef.current?.removeChild(renderer.domElement);
        };
    }, []);

    // ----- Serial Connection: Connect Phase (Triggered by Connect Button) -----
    const connectToBoard = async () => {
        try {
            const port = await navigator.serial.requestPort();
            // Use the baud rate your device requires. Here we use 230400 as an example.
            await port.open({ baudRate: 230400 });
            console.log("Serial port opened.");
            setDeviceConnected(true);
            portRef.current = port;
            // Note: We do NOT start reading data until the game is launched.
        } catch (err) {
            console.error("Serial connection error:", err);
        }
    };


    function getLevelMessage(level: number): string {
        const messages: string[] = [
            "Space just got serious!",
            "Is it hot in here, or is it just your thrusters?",
            "Even aliens are impressed!",
            "Your space license is getting upgraded!",
            "Houston, we have a badass!",
            "The Force is strong with this one!",
            "Space obstacles are crying in fear!",
            "You're making black holes jealous!",
            "Cosmic achievement unlocked!",
            "Captain's log: Still awesome!",
        ];

        return messages[level % messages.length];
    }

    const triggerExplosion = () => {
        // Prevent multiple triggers
        if (explosionTriggered) return;
        setExplosionTriggered(true);

        if (sceneRef.current && cube) {
            const explosionPosition = cube.position.clone();

            // 1. Create and animate the explosion sphere
            const explosionGeometry = new THREE.SphereGeometry(0.5, 32, 32);
            const explosionMaterial = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 1,
            });
            const explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
            explosionMesh.position.copy(explosionPosition);
            sceneRef.current.add(explosionMesh);

            const explosionDuration = 1500; // milliseconds
            const startTime = Date.now();
            const animateExplosionMesh = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / explosionDuration;
                // Scale up and fade out
                const scale = 1 + progress * 4;
                explosionMesh.scale.set(scale, scale, scale);
                explosionMesh.material.opacity = 1 - progress;
                if (progress < 1) {
                    requestAnimationFrame(animateExplosionMesh);
                } else {
                    sceneRef.current?.remove(explosionMesh);
                }
            };
            animateExplosionMesh();

            // 2. Create and animate explosion particles
            const particleCount = 100;
            const particlesGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const velocities = new Float32Array(particleCount * 3);
            for (let i = 0; i < particleCount; i++) {
                // Start at the explosion position
                positions[i * 3] = explosionPosition.x;
                positions[i * 3 + 1] = explosionPosition.y;
                positions[i * 3 + 2] = explosionPosition.z;

                // Generate random direction and speed
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.random() * Math.PI;
                const speed = Math.random() * 2 + 1;
                velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
                velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                velocities[i * 3 + 2] = speed * Math.cos(phi);
            }
            particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const particlesMaterial = new THREE.PointsMaterial({
                color: 0xffaa00,
                size: 0.1,
                transparent: true,
                opacity: 1,
            });
            const particles = new THREE.Points(particlesGeometry, particlesMaterial);
            sceneRef.current.add(particles);

            const particlesStartTime = Date.now();
            const particlesDuration = 1500;
            const animateParticles = () => {
                const elapsed = Date.now() - particlesStartTime;
                const progress = elapsed / particlesDuration;
                // Cast as Float32Array to match the actual type
                const positionsArray = particlesGeometry.getAttribute('position').array as Float32Array;

                // Move each particle outward
                for (let i = 0; i < particleCount; i++) {
                    positionsArray[i * 3] += velocities[i * 3] * 0.02;
                    positionsArray[i * 3 + 1] += velocities[i * 3 + 1] * 0.02;
                    positionsArray[i * 3 + 2] += velocities[i * 3 + 2] * 0.02;
                }
                particlesGeometry.getAttribute('position').needsUpdate = true;
                particlesMaterial.opacity = 1 - progress;
                if (progress < 1) {
                    requestAnimationFrame(animateParticles);
                } else {
                    sceneRef.current?.remove(particles);
                }
            };
            animateParticles();

            // 3. Create a brief flash effect
            const flash = new THREE.PointLight(0xffaa00, 2, 10);
            flash.position.copy(explosionPosition);
            sceneRef.current.add(flash);
            setTimeout(() => {
                sceneRef.current?.remove(flash);
            }, 100); // Flash lasts only 100ms

            // End the game after the explosion effect
            setTimeout(() => {
                if (score > highScore) {
                    setHighScore(score);
                }
                setGameOver(true);
                setIsGameRunning(false);
            }, 2000); // Delay to allow explosion to complete
        }
    };


    useEffect(() => {
        if (!sceneRef.current || !isGameRunning || gameOver || levelUpPaused) return;

        // Cache coin geometry and material once
        const coinGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 32);
        const coinMaterial = new THREE.MeshPhysicalMaterial({
            color: "#ffd700", // Gold color
            emissive: "#ffd700",
            metalness: 0.8,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
        });
        const cachedCoinMesh = new THREE.Mesh(coinGeometry, coinMaterial);

        const interval = setInterval(() => {
            if (!sceneRef.current || !isGameRunning) return;

            const obstacleTypes = [
                new THREE.SphereGeometry(0.5),
                new THREE.TetrahedronGeometry(0.6),
                new THREE.OctahedronGeometry(0.6),
                new THREE.DodecahedronGeometry(0.5),
                new THREE.TorusGeometry(0.4, 0.2, 16, 32),
                // Use the cached coin geometry/material for coin obstacles
                cachedCoinMesh.geometry,
            ];

            const baseColors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];
            const selectedColor = baseColors[Math.floor(Math.random() * baseColors.length)];

            // Use the level to increase difficulty (and adjust material properties)
            const obstacleMaterial = new THREE.MeshPhysicalMaterial({
                color: selectedColor,
                metalness: Math.random(),
                roughness: Math.random() * 0.5,
                emissive: selectedColor,
                emissiveIntensity: 0.2 + level * 0.05,
            });

            // Randomly select a geometry
            const geometryIndex = Math.floor(Math.random() * obstacleTypes.length);
            const selectedGeometry = obstacleTypes[geometryIndex];

            const obstacle = new THREE.Mesh(selectedGeometry, obstacleMaterial);

            // Increase x-range with level for more variability
            const xRange = 3 + level * 0.2;
            obstacle.position.set((Math.random() - 0.5) * xRange, 5, 0);
            obstacle.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;

            sceneRef.current.add(obstacle);
            setObstacles((prev) => [...prev, obstacle]);

        }, Math.max(1500 - level * 100, 500)); // Spawn frequency increases with level

        return () => clearInterval(interval);
    }, [isGameRunning, level, gameOver, levelUpPaused]);



    useEffect(() => {
        if (!cube || gameOver || !isGameRunning || levelUpPaused) return;

        const checkCollision = () => {
            // Check collision with power‑up first
            if (powerUp) {
                if (cube.position.distanceTo(powerUp.position) < 0.7) {
                    setPowerUpTimer(10);
                    sceneRef.current?.remove(powerUp);
                    setPowerUp(null);
                }
            }

            // Check collisions with obstacles
            obstacles.forEach((obstacle) => {
                obstacle.rotation.x += 0.02;
                obstacle.rotation.y += 0.02;
                obstacle.position.y -= gameSpeed;

                if (obstacle.position.y < -1) {
                    setObstacles((prev) => prev.filter((o) => o !== obstacle));
                    sceneRef.current?.remove(obstacle);
                }

                if (obstacle.position.distanceTo(cube.position) < 0.7) {
                    // If it's a coin (gold coin collectible)
                    if (obstacle.geometry instanceof THREE.CylinderGeometry) {
                        setScore((prev) => prev + 30);
                        sceneRef.current?.remove(obstacle);
                        setObstacles((prev) => prev.filter((o) => o !== obstacle));
                        setShowCongrats(true);
                        setTimeout(() => setShowCongrats(false), 2000);
                    } else {
                        if (!explosionTriggered) {
                            setGameSpeed(0); // Freeze obstacles
                            triggerExplosion();
                        }
                    }
                }
            });
        };

        const gameLoop = setInterval(() => {
            if (isGameRunning && !gameOver) checkCollision();
        }, 16);

        return () => clearInterval(gameLoop);
    }, [cube, obstacles, gameOver, isGameRunning, powerUp, explosionTriggered, gameSpeed, levelUpPaused]);

    // ----- Start Game: Send START command, countdown, and begin reading serial data -----
    const startGame = async () => {
        if (!deviceConnected) {
            alert("Please select a device before starting the game.");
            return;
        }
        // Optionally, reset game state (score, obstacles, etc.) here.

        // Send START command to the device.
        if (portRef.current && portRef.current.writable) {
            const writer = portRef.current.writable.getWriter();
            await writer.write(new TextEncoder().encode("START\n"));
            writer.releaseLock();
            console.log("Sent START command to device.");
        }

        // Start countdown before game starts.
        setShowCountdown(true);
        setCountdown(3);
        const countdownTimer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownTimer);
                    setShowCountdown(false);
                    setIsGameRunning(true);
                    startSerialReadLoop(); // begin reading serial data
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };


    class EnvelopeFilter {
        private circularBuffer: number[];
        private sum: number = 0;
        private dataIndex: number = 0;
        private readonly bufferSize: number;
      
        constructor(bufferSize: number) {
          this.bufferSize = bufferSize;
          this.circularBuffer = new Array(bufferSize).fill(0);
        }
      
        getEnvelope(absEmg: number): number {
          this.sum -= this.circularBuffer[this.dataIndex];
          this.sum += absEmg;
          this.circularBuffer[this.dataIndex] = absEmg;
          this.dataIndex = (this.dataIndex + 1) % this.bufferSize;
          return (this.sum / this.bufferSize) * 2;
        }
      }
      
      // Usage example
      const envelope1 = new EnvelopeFilter(64);
      const envelope2 = new EnvelopeFilter(64);
      

    // ----- Serial Read Loop: Begin reading data from device after game launch -----
    const startSerialReadLoop = async () => {
        try {
            if (!portRef.current) return;
            if (!portRef.current.readable) {
                console.error("Port is not readable");
                return;
            }

            const reader = portRef.current.readable.getReader();
            readerRef.current = reader;
            readLoopActiveRef.current = true;

            const blockSize = 9; // Declare blockSize here.
            let previousSampleNumber = -1;
            const moveSpeed = 0.02;
            let accumulatedBuffer = new Uint8Array(0);

            const SYNC_BYTE_1 = 0xC7;
            const SYNC_BYTE_2 = 0x7C;
            const notchFilters = Array.from({ length: 3}, () => new Notch());
            const EXGFilters = Array.from({ length:3 }, () => new EXGFilter());
            notchFilters.forEach((filter) => {
                filter.setbits(500)// the bits value for all instances
            });
            EXGFilters.forEach((filter) => {
                filter.setbits((12).toString(),500);//Set the bits value for all instances
            });
    

            while (readLoopActiveRef.current && reader) {
                const { value, done } = await reader.read();
                if (done) {
                    console.warn("Serial stream closed");
                    break;
                }
                if (value) {
                    const newBuffer = new Uint8Array(accumulatedBuffer.length + value.length);
                    newBuffer.set(accumulatedBuffer);
                    newBuffer.set(value, accumulatedBuffer.length);
                    accumulatedBuffer = newBuffer;

                    // Inside your serial read loop (in startSerialReadLoop):
                    while (accumulatedBuffer.length >= blockSize) {
                        // // Log raw buffer as hex for debugging:
                        // console.log("Raw buffer:", Array.from(accumulatedBuffer).map(b => b.toString(16).padStart(2, "0")).join(" "));

                        let syncIndex = -1;
                        // Look for sync sequence
                        for (let i = 0; i < accumulatedBuffer.length - 1; i++) {
                            if (
                                accumulatedBuffer[i] === SYNC_BYTE_1 &&
                                accumulatedBuffer[i + 1] === SYNC_BYTE_2
                            ) {
                                syncIndex = i;
                                break;
                            }
                        }

                        // If no sync found, flush the buffer.
                        if (syncIndex === -1) {
                            console.warn("No sync found, flushing buffer...");
                            accumulatedBuffer = new Uint8Array(0);
                            break;
                        }

                        // Remove garbage data before sync
                        if (syncIndex > 0) {
                            // console.warn("Misaligned data detected, realigning...");
                            accumulatedBuffer = accumulatedBuffer.slice(syncIndex);
                        }

                        if (accumulatedBuffer.length < blockSize) break;

                        const block = accumulatedBuffer.slice(0, blockSize);
                        accumulatedBuffer = accumulatedBuffer.slice(blockSize);

                        // Parse packet (assuming sample number is at index 2)
                        const sampleNumber = block[2];
                        const dataView = new DataView(block.buffer, block.byteOffset, block.byteLength);
                        const channelData: number[] = [];
                        for (let channel = 0; channel < 3; channel++) {
                            const channelOffset = 3 + channel * 2;
                            const sample = dataView.getInt16(channelOffset, false);
                            channelData.push(
                                notchFilters[channel].process(
                                    EXGFilters[channel].process(
                                        sample,4
                                    ),
                                  1
                                )
                            );                        }

                        // Sample checking...
                        if (previousSampleNumber !== -1) {
                            if (sampleNumber - previousSampleNumber > 1) {
                                console.error("Error: Sample Lost. Expected:", previousSampleNumber + 1, "Got:", sampleNumber);
                            } else if (sampleNumber === previousSampleNumber) {
                                console.error("Error: Duplicate sample", sampleNumber);
                            }
                        }
                        previousSampleNumber = sampleNumber;
                        const env1=envelope1.getEnvelope(Math.abs(channelData[0]));
                        const env2=envelope2.getEnvelope(Math.abs(channelData[1]));
                        console.log("Moving left:", envelope1.getEnvelope(Math.abs(channelData[0])) );
                        console.log("Moving right:", envelope2.getEnvelope(Math.abs(channelData[1])));

                        if (isGameRunningRef.current && cube) {
                            if (env1>400
                            ){
                                // console.log("Moving left:", envelope1.getEnvelope(Math.abs(channelData[0])) );
                                cube.position.x = Math.max(cube.position.x - moveSpeed, -3);
                                // console.log("New Cube X:", cube.position.x);
                            }
                            else 
                            if ( env2>430
                            ){
                                // console.log("Moving right:", envelope2.getEnvelope(Math.abs(channelData[1])));
                                cube.position.x = Math.min(cube.position.x + moveSpeed, 3);
                                // console.log("New Cube X:", cube.position.x);
                            }
                            else{
                              console.log("hello");  
                            }
                        }
                    }

                }
                await new Promise((resolve) => setTimeout(resolve, 1));
            }
        } catch (err) {
            console.error("Error in serial read loop:", err);
        }
    };


    // Cleanup for serial connection.
    useEffect(() => {
        return () => {
            readLoopActiveRef.current = false;
            readerRef.current
                ?.cancel()
                .catch((err) => console.error("Error cancelling reader:", err))
                .finally(() => {
                    readerRef.current?.releaseLock();
                    portRef.current?.close().catch((err) =>
                        console.error("Error closing port:", err)
                    );
                });
        };
    }, []);


    useEffect(() => {
        // Calculate the new level: Level = floor(score / 500) + 1
        const newLevel = Math.floor(score / 500) + 1;
        if (newLevel > level) {
            setLevel(newLevel);
            // Pause the game until the player acknowledges the level up.
            setLevelUpPaused(true);
        }
    }, [score, level]);


    // Stop game
    const stopGame = () => {
        setIsGameRunning(false);

        // Remove all obstacles
        if (sceneRef.current) {
            obstacles.forEach((obstacle) => sceneRef.current?.remove(obstacle));
            if (powerUp) {
                sceneRef.current.remove(powerUp);
                setPowerUp(null);
            }
        }
        setObstacles([]);

    };

//     // Restart game: reset all game state and start a new round.
//   const restartGame = () => {
//     if (sceneRef.current) {
//       obstacles.forEach((obstacle) => sceneRef.current.remove(obstacle));
//       coins.forEach((coin) => sceneRef.current.remove(coin));
//       if (powerUp) {
//         sceneRef.current.remove(powerUp);
//       }
//     }
//     setScore(0);
//     setGameOver(false);
//     setLevel(1);
//     setIsGameRunning(false);
//     setObstacles([]);
//     setPowerUp(null);
//     setPowerUpTimer(0);
//     setGameSpeed(0.05);
//     setExplosionTriggered(false);
//     setShowCongrats(false);
//     if (cube) {
//       cube.position.set(0, 0, 0);
//       cube.rotation.set(0, 0, 0);
//     }
//     startGame();
//   };

    return (
        <div className="relative w-screen h-screen bg-gradient-to-b from-blue-900 to-black overflow-hidden">

            {/* Animated space particles background */}
            <div className="absolute inset-0 z-0">
                {Array.from({ length: 150 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            width: `${Math.random() * 4}px`,
                            height: `${Math.random() * 4}px`,
                            backgroundColor: ['#ffffff', '#64dfdf', '#ff9e00', '#9d4edd'][Math.floor(Math.random() * 4)],
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            opacity: Math.random() * 0.8 + 0.2,
                            animation: `twinkle ${Math.random() * 5 + 3}s infinite, float ${Math.random() * 20 + 10}s infinite linear`
                        }}
                    />
                ))}
            </div>


            <div className="absolute bottom-5 right-5 z-20 flex gap-3">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={connectToBoard}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center"
                    disabled={deviceConnected}
                >
                    <span className="mr-2">🔌</span> Connect
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startGame}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center disabled:opacity-50"
                    disabled={!deviceConnected || isGameRunning}
                >
                    <span className="mr-2">🚀</span> Launch
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={stopGame}
                    className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-red-500/30 transition-all duration-200 flex items-center disabled:opacity-50"
                    disabled={!isGameRunning}
                >
                    <span className="mr-2">⏹️</span> Abort
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowInstructions(true)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-blue-500/30 transition-all duration-200 flex items-center"
                >
                    <span className="mr-2">📋</span> Help
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push("/game_components/data-viewer")}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-purple-500/30 transition-all duration-200 flex items-center"
                >
                    <span className="mr-2">📊</span> See Data
                </motion.button>

            </div>
            );

            {/* 3D Styled Instructions Modal */}
            <div className="relative w-screen h-screen overflow-hidden">
                {/* Your game canvas and UI elements go here */}

                {/* Use the imported InstructionsModal component */}
                <InstructionsModal
                    showInstructions={showInstructions}
                    setShowInstructions={setShowInstructions}
                />
            </div>

            {/* Star background effect */}
            <div className="absolute inset-0 z-0 bg-black">
                {Array.from({ length: 100 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-white"
                        style={{
                            width: `${Math.random() * 3}px`,
                            height: `${Math.random() * 3}px`,
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            opacity: Math.random() * 0.8 + 0.2,
                            animation: `twinkle ${Math.random() * 5 + 3}s infinite`
                        }}
                    />
                ))}
            </div>

            {/* Game title */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute top-5 left-5 z-10 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600"
            >
                COSMIC DODGE
            </motion.div>

            {/* Game canvas */}
            <div ref={mountRef} className="absolute inset-0 z-10" />

            {/* Game controls info */}
            <div className="absolute bottom-5 left-5 z-20 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-lg">
                Use ← → Arrow Keys to Move

            </div>

            {/* Score display */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-5 right-5 z-20"
            >
                <div className="bg-black bg-opacity-70 text-white px-6 py-3 rounded-xl border border-blue-500 shadow-lg shadow-blue-500/20">
                    <div className="text-sm text-blue-300">SCORE</div>
                    <div className="text-3xl font-bold">{score}</div>
                </div>
            </motion.div>

            {/* High score display */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-24 right-5 z-20"
            >
                <div className="bg-black bg-opacity-70 text-white px-6 py-3 rounded-xl border border-purple-500 shadow-lg shadow-purple-500/20">
                    <div className="text-sm text-purple-300">HIGH SCORE</div>
                    <div className="text-2xl font-bold">{highScore}</div>
                </div>
            </motion.div>

            {/* Level display */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-48 right-5 z-20"
            >
                <div className="bg-black bg-opacity-70 text-white px-6 py-3 rounded-xl border border-yellow-500 shadow-lg shadow-yellow-500/20">
                    <div className="text-sm text-yellow-300">LEVEL</div>
                    <div className="text-2xl font-bold">{level}</div>
                </div>
            </motion.div>
            {/* Level up notification */}
            {levelUpPaused && (
                <div className="absolute inset-0 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative bg-gradient-to-br from-indigo-900 to-purple-900 p-8 rounded-xl max-w-md mx-4 border-2 border-indigo-400 shadow-2xl"
                    >
                        {/* Background sparkles */}
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute text-yellow-300 text-opacity-80"
                                style={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    animation: `ping ${Math.random() * 2 + 1}s infinite ${Math.random() * 2}s`
                                }}
                            >
                                ✨
                            </div>
                        ))}
                        <div className="text-5xl text-center mb-2">🚀</div>
                        <h2 className="text-3xl font-black text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-400">
                            LEVEL {level} UNLOCKED!
                        </h2>
                        <div className="text-center mb-4 text-gray-200">
                            "{getLevelMessage(level)}"
                        </div>
                        <div className="mb-6 text-center text-indigo-200">
                            Get ready for faster obstacles and new challenges!
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                if (sceneRef.current) {
                                    obstacles.forEach(obstacle => sceneRef.current?.remove(obstacle));
                                }
                                setObstacles([]);
                                setLevelUpPaused(false);
                            }}
                            className="block w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg text-xl font-bold transition-all duration-300"
                        >
                            Let's Go! 🚀
                        </motion.button>
                    </motion.div>
                </div>
            )}

            {/* Game over modal with enhanced effects */}
            {gameOver && (
                <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-70 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="bg-gradient-to-b from-red-800 to-red-950 text-white px-8 py-6 rounded-2xl shadow-2xl border-2 border-red-500 max-w-md w-full mx-4 relative overflow-hidden"
                    >
                        {/* Animated background effects */}
                        <div className="absolute inset-0 overflow-hidden">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full bg-red-500 opacity-20"
                                    style={{
                                        width: `${Math.random() * 40 + 10}px`,
                                        height: `${Math.random() * 40 + 10}px`,
                                        top: `${Math.random() * 100}%`,
                                        left: `${Math.random() * 100}%`,
                                        animation: `float ${Math.random() * 10 + 5}s infinite ease-in-out`
                                    }}
                                />
                            ))}
                        </div>

                        <div className="relative">
                            <div className="text-5xl text-center mb-4">💥</div>
                            <div className="text-4xl font-black text-center mb-2">Game Over!</div>
                            <div className="text-xl text-center mb-4">Your ship has been destroyed</div>
                            <div className="text-center mb-6">
                                <div className="text-lg text-gray-300">Final Score</div>
                                <div className="text-6xl font-black text-center my-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-300">
                                    {score.toLocaleString()}
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-6 border-t border-b border-red-700 py-3">
                                <div>
                                    <div className="text-red-300">Level Reached</div>
                                    <div className="text-2xl font-bold">{level}</div>
                                </div>
                                <div>
                                    <div className="text-red-300">Obstacles Dodged</div>
                                    <div className="text-2xl font-bold">{Math.floor(score / 20)}</div>
                                </div>
                            </div>

                            {score >= highScore && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-xl text-center mb-6 text-yellow-300 font-bold bg-yellow-900 bg-opacity-30 py-2 px-4 rounded-lg"
                                >
                                    <span className="mr-2">🏆</span>
                                    NEW HIGH SCORE!
                                    <span className="ml-2">🏆</span>
                                </motion.div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                
                                className="block w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-4 rounded-lg text-xl font-bold transition-all duration-300 transform hover:scale-105 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-10 w-10 bg-white opacity-10 rounded-full animate-ping"></div>
                                </div>
                                <span className="relative">Try Again 🚀</span>
                            </motion.button>

                            <div className="text-center mt-4 text-gray-400 text-sm italic">
                                Don't give up, cosmic adventurer!
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Animated congrats notification */}
            {showCongrats && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: -50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0, y: 50 }}
                    transition={{ duration: 0.5, type: "spring" }}
                    className="fixed top-1/2 left-2/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-yellow-400 to-amber-500 text-black p-6 rounded-xl shadow-xl flex flex-col items-center"
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-6xl mb-2"
                    >
                        🪙
                    </motion.div>
                    <div className="text-2xl font-bold mt-2 text-center">
                        Great! <br />You found a cosmic coin!
                    </div>
                    <div className="mt-2 text-amber-800 text-center">
                        +30 points!
                    </div>
                </motion.div>
            )}
            {/* Countdown overlay */}
            {showCountdown && (
                <div className="absolute inset-0 flex items-center justify-center z-40 bg-black bg-opacity-60">
                    <motion.div
                        key={countdown}
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-8xl font-bold text-white"
                    >
                        {countdown}
                    </motion.div>
                </div>
            )}

            {/* Game start instructions */}
            {!gameOver && score === 0 && !isGameRunning && !showCountdown && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                >

                </motion.div>
            )}

        </div>
    );
}