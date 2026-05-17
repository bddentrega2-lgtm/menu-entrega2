import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";

const ruta = window.location.pathname.split("/").filter(Boolean);
const esAdmin = ruta[0] === "admin";
const slugComercio = esAdmin ? ruta[1] || "demo" : ruta[0] || "demo";

const comercioInicial = {
  nombre: "Pedi2 Demo",
  descripcion: "Menú digital para recibir pedidos por WhatsApp.",
  whatsapp: "584120000000",
  direccion: "Maracay, Aragua",
  tiempoEstimado: "30 - 45 min",
  minimoPedido: 5,
  abierto: true,
  portada:
    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80",
  logoUrl: "",
  colorPrimario: "#003AA0",
  adminPin: "1234",
};

function App() {
  const [vista] = useState(esAdmin ? "admin" : "cliente");
  const [comercioId, setComercioId] = useState(null);

  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [mensajeSistema, setMensajeSistema] = useState("");

  const [comercio, setComercio] = useState(comercioInicial);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);

  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  const [pinIngresado, setPinIngresado] = useState("");
  const [adminAutorizado, setAdminAutorizado] = useState(() => {
    return sessionStorage.getItem(`pedi2_admin_${slugComercio}`) === "ok";
  });

  const [cliente, setCliente] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
    lat: "",
    lng: "",
    metodoPago: "Pago móvil",
    notas: "",
  });

  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    categoria: "",
    imagen: "",
    activo: true,
    popular: false,
  });

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  async function cargarDatosIniciales() {
    try {
      setCargandoDatos(true);
      setErrorCarga("");

      const { data: comercioData, error: comercioError } = await supabase
        .from("comercios")
        .select("*")
        .eq("slug", slugComercio)
        .single();

      if (comercioError || !comercioData) {
        throw comercioError || new Error("Comercio no encontrado");
      }

      setComercioId(comercioData.id);

      const comercioMapeado = {
        nombre: comercioData.nombre || comercioInicial.nombre,
        descripcion: comercioData.descripcion || comercioInicial.descripcion,
        whatsapp: comercioData.whatsapp || comercioInicial.whatsapp,
        direccion: comercioData.direccion || comercioInicial.direccion,
        tiempoEstimado:
          comercioData.tiempo_estimado || comercioInicial.tiempoEstimado,
        minimoPedido: Number(comercioData.minimo_pedido || 0),
        abierto: comercioData.abierto,
        portada: comercioData.portada || comercioInicial.portada,
        logoUrl: comercioData.logo_url || "",
        colorPrimario: comercioData.color_primario || "#003AA0",
        adminPin: comercioData.admin_pin || "1234",
      };

      setComercio(comercioMapeado);

      const { data: productosData, error: productosError } = await supabase
        .from("productos")
        .select("*")
        .eq("comercio_id", comercioData.id)
        .order("created_at", { ascending: true });

      if (productosError) {
        throw productosError;
      }

      setProductos(
        (productosData || []).map((producto) => ({
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: Number(producto.precio),
          categoria: producto.categoria,
          imagen: producto.imagen,
          activo: producto.activo,
          popular: producto.popular,
        }))
      );

      if (esAdmin) {
        await cargarPedidos(comercioData.id);
      }
    } catch (error) {
      console.error(error);
      setErrorCarga("No pudimos cargar este comercio.");
    } finally {
      setCargandoDatos(false);
    }
  }

  async function cargarPedidos(idComercio = comercioId) {
    if (!idComercio) return;

    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("comercio_id", idComercio)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMensajeSistema("No pudimos cargar los pedidos.");
      return;
    }

    setPedidos(data || []);
  }

  const productosActivos = productos.filter((producto) => producto.activo);

  const categorias = [
    "Todos",
    ...new Set(productosActivos.map((producto) => producto.categoria)),
  ];

  const productosFiltrados = useMemo(() => {
    return productosActivos.filter((producto) => {
      const texto = busqueda.toLowerCase().trim();

      const coincideCategoria =
        categoriaActiva === "Todos" || producto.categoria === categoriaActiva;

      const coincideBusqueda =
        producto.nombre.toLowerCase().includes(texto) ||
        producto.descripcion.toLowerCase().includes(texto) ||
        producto.categoria.toLowerCase().includes(texto);

      return coincideCategoria && coincideBusqueda;
    });
  }, [productosActivos, categoriaActiva, busqueda]);

  const subtotal = carrito.reduce((total, producto) => {
    return total + producto.precio * producto.cantidad;
  }, 0);

  const cantidadProductos = carrito.reduce((total, producto) => {
    return total + producto.cantidad;
  }, 0);

  const pedidoValido =
    carrito.length > 0 &&
    cliente.nombre.trim() !== "" &&
    cliente.telefono.trim() !== "" &&
    cliente.direccion.trim() !== "";

  function actualizarCliente(campo, valor) {
    setCliente({
      ...cliente,
      [campo]: valor,
    });
  }

  function agregarAlCarrito(producto) {
    const existe = carrito.find((item) => item.id === producto.id);

    if (existe) {
      setCarrito(
        carrito.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      );
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }

    setCarritoAbierto(true);
  }

  function quitarDelCarrito(productoId) {
    const existe = carrito.find((item) => item.id === productoId);

    if (!existe) return;

    if (existe.cantidad === 1) {
      setCarrito(carrito.filter((item) => item.id !== productoId));
    } else {
      setCarrito(
        carrito.map((item) =>
          item.id === productoId
            ? { ...item, cantidad: item.cantidad - 1 }
            : item
        )
      );
    }
  }

  function eliminarProductoDelCarrito(productoId) {
    setCarrito(carrito.filter((item) => item.id !== productoId));
  }

  function limpiarCarrito() {
    setCarrito([]);
    setCarritoAbierto(false);
  }

  function obtenerUbicacionActual() {
    setMensajeSistema("");

    if (!navigator.geolocation) {
      setMensajeSistema("Tu navegador no permite obtener ubicación.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setCliente({
          ...cliente,
          lat: posicion.coords.latitude.toString(),
          lng: posicion.coords.longitude.toString(),
        });

        setMensajeSistema("Ubicación cargada correctamente.");
      },
      () => {
        setMensajeSistema(
          "No pudimos obtener la ubicación. Puedes escribir la dirección manualmente."
        );
      }
    );
  }

  async function actualizarComercio(campo, valor) {
    if (!comercioId) return;

    const comercioActualizado = {
      ...comercio,
      [campo]: valor,
    };

    setComercio(comercioActualizado);

    const mapaCampos = {
      tiempoEstimado: "tiempo_estimado",
      minimoPedido: "minimo_pedido",
      logoUrl: "logo_url",
      colorPrimario: "color_primario",
      adminPin: "admin_pin",
    };

    const campoSupabase = mapaCampos[campo] || campo;

    const { error } = await supabase
      .from("comercios")
      .update({
        [campoSupabase]: valor,
      })
      .eq("id", comercioId);

    if (error) {
      console.error(error);
      setMensajeSistema("No se pudo guardar el comercio.");
    } else {
      setMensajeSistema("Cambios del comercio guardados.");
    }
  }

  async function agregarProductoAdmin() {
    if (
      nuevoProducto.nombre.trim() === "" ||
      nuevoProducto.precio === "" ||
      nuevoProducto.categoria.trim() === ""
    ) {
      alert("Completa nombre, precio y categoría.");
      return;
    }

    const productoParaGuardar = {
      comercio_id: comercioId,
      nombre: nuevoProducto.nombre,
      descripcion: nuevoProducto.descripcion,
      precio: Number(nuevoProducto.precio),
      categoria: nuevoProducto.categoria,
      imagen:
        nuevoProducto.imagen.trim() ||
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
      activo: true,
      popular: nuevoProducto.popular,
    };

    const { error } = await supabase.from("productos").insert(productoParaGuardar);

    if (error) {
      console.error(error);
      setMensajeSistema("No se pudo agregar el producto.");
      return;
    }

    setNuevoProducto({
      nombre: "",
      descripcion: "",
      precio: "",
      categoria: "",
      imagen: "",
      activo: true,
      popular: false,
    });

    setMensajeSistema("Producto agregado correctamente.");
    await cargarDatosIniciales();
  }

  async function actualizarProducto(id, campo, valor) {
    const productosActualizados = productos.map((producto) =>
      producto.id === id
        ? {
            ...producto,
            [campo]: campo === "precio" ? Number(valor) : valor,
          }
        : producto
    );

    setProductos(productosActualizados);

    const { error } = await supabase
      .from("productos")
      .update({
        [campo]: campo === "precio" ? Number(valor) : valor,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMensajeSistema("No se pudo actualizar el producto.");
    } else {
      setMensajeSistema("Producto actualizado.");
    }
  }

  async function alternarProductoActivo(id) {
    const producto = productos.find((item) => item.id === id);
    if (!producto) return;

    await actualizarProducto(id, "activo", !producto.activo);
  }

  async function alternarProductoPopular(id) {
    const producto = productos.find((item) => item.id === id);
    if (!producto) return;

    await actualizarProducto(id, "popular", !producto.popular);
  }

  async function eliminarProductoAdmin(id) {
    const confirmar = confirm("¿Seguro que quieres eliminar este producto?");
    if (!confirmar) return;

    const { error } = await supabase.from("productos").delete().eq("id", id);

    if (error) {
      console.error(error);
      setMensajeSistema("No se pudo eliminar el producto.");
      return;
    }

    setMensajeSistema("Producto eliminado.");
    await cargarDatosIniciales();
  }

  async function actualizarEstadoPedido(idPedido, nuevoEstado) {
    const { error } = await supabase
      .from("pedidos")
      .update({
        estado: nuevoEstado,
      })
      .eq("id", idPedido);

    if (error) {
      console.error(error);
      setMensajeSistema("No se pudo actualizar el pedido.");
      return;
    }

    setMensajeSistema("Estado del pedido actualizado.");
    await cargarPedidos();
  }

  async function enviarPedidoPorWhatsApp() {
    if (!pedidoValido) {
      alert("Completa nombre, teléfono, dirección y agrega al menos un producto.");
      return;
    }

    const pedidoParaGuardar = {
      comercio_id: comercioId,
      cliente_nombre: cliente.nombre,
      cliente_telefono: cliente.telefono,
      direccion_entrega: cliente.direccion,
      lat: cliente.lat || null,
      lng: cliente.lng || null,
      metodo_pago: cliente.metodoPago,
      notas: cliente.notas,
      productos: carrito.map((producto) => ({
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: producto.cantidad,
        total: producto.precio * producto.cantidad,
      })),
      subtotal,
      estado: "pendiente",
      canal: "pedi2",
    };

    const { error } = await supabase.from("pedidos").insert(pedidoParaGuardar);

    if (error) {
      console.error(error);
      alert("No se pudo guardar el pedido. Intenta nuevamente.");
      return;
    }

    let mensaje = `*Nuevo pedido desde Pedi2*%0A%0A`;
    mensaje += `*Comercio:* ${comercio.nombre}%0A%0A`;

    mensaje += `*Datos del cliente*%0A`;
    mensaje += `Nombre: ${cliente.nombre}%0A`;
    mensaje += `Teléfono: ${cliente.telefono}%0A`;
    mensaje += `Dirección: ${cliente.direccion}%0A`;

    if (cliente.lat && cliente.lng) {
      mensaje += `Ubicación: https://www.google.com/maps?q=${cliente.lat},${cliente.lng}%0A`;
    }

    mensaje += `Método de pago: ${cliente.metodoPago}%0A`;

    if (cliente.notas.trim() !== "") {
      mensaje += `Notas: ${cliente.notas}%0A`;
    }

    mensaje += `%0A*Detalle del pedido*%0A`;

    carrito.forEach((producto, index) => {
      mensaje += `${index + 1}. ${producto.nombre} x${producto.cantidad} - $${(
        producto.precio * producto.cantidad
      ).toFixed(2)}%0A`;
    });

    mensaje += `%0A*Total de productos:* ${cantidadProductos}%0A`;
    mensaje += `*Subtotal:* $${subtotal.toFixed(2)}%0A`;
    mensaje += `%0A*Dirección del comercio:* ${comercio.direccion}%0A`;
    mensaje += `%0APor favor confirmar disponibilidad y costo de delivery.`;

    const telefonoLimpio = comercio.whatsapp.replace(/\D/g, "");
    const url = `https://wa.me/${telefonoLimpio}?text=${mensaje}`;

    window.open(url, "_blank");
    setMensajeSistema("Pedido guardado y enviado a WhatsApp.");
  }

  function copiarLinkMenu() {
    navigator.clipboard.writeText(`${window.location.origin}/${slugComercio}`);
    setMensajeSistema("Link del menú copiado.");
  }

  function cerrarSesionAdmin() {
    sessionStorage.removeItem(`pedi2_admin_${slugComercio}`);
    setAdminAutorizado(false);
    setPinIngresado("");
  }

  if (cargandoDatos) {
    return (
      <div className="pantallaCarga">
        <div className="brandLoading">
          Pedi<span>2</span>
        </div>
        <p>Cargando menú digital...</p>
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="pantallaCarga">
        <div className="brandLoading">
          Pedi<span>2</span>
        </div>
        <p>{errorCarga}</p>
        <a className="loadingLink" href="/demo">
          Volver al demo
        </a>
      </div>
    );
  }

  if (esAdmin && comercio.adminPin && !adminAutorizado) {
    return (
      <div className="pinScreen" style={{ "--brand": comercio.colorPrimario }}>
        <div className="pinCard">
          <div className="adminBrand">
            Pedi<span>2</span>
          </div>

          <h1>Acceso administrador</h1>
          <p>Ingresa el PIN del comercio para continuar.</p>

          <input
            type="password"
            placeholder="PIN de acceso"
            value={pinIngresado}
            onChange={(e) => setPinIngresado(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (pinIngresado.trim() === String(comercio.adminPin).trim()) {
                  sessionStorage.setItem(`pedi2_admin_${slugComercio}`, "ok");
                  setAdminAutorizado(true);
                } else {
                  alert("PIN incorrecto");
                }
              }
            }}
          />

          <button
            onClick={() => {
              if (pinIngresado.trim() === String(comercio.adminPin).trim()) {
                sessionStorage.setItem(`pedi2_admin_${slugComercio}`, "ok");
                setAdminAutorizado(true);
              } else {
                alert("PIN incorrecto");
              }
            }}
          >
            Entrar al panel
          </button>

          <a href={`/${slugComercio}`}>Volver al menú</a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="app"
      style={{
        "--brand": comercio.colorPrimario || "#003AA0",
      }}
    >
      <nav className="topBar">
        <a className="brandText" href={`/${slugComercio}`}>
          Pedi<span>2</span>
        </a>

        {vista === "cliente" ? (
          <div className="navLinks">
            <a href="#inicio">Inicio</a>
            <a href="#menu">Menú</a>
            <a href="#destacados">Destacados</a>
          </div>
        ) : (
          <div className="navLinks">
            <a href={`/${slugComercio}`}>Ver menú</a>
            <a href="#pedidos">Pedidos</a>
            <a href="#productos">Productos</a>
          </div>
        )}

        <div className="topActions">
          {vista === "admin" ? (
            <>
              <button onClick={copiarLinkMenu}>Copiar link</button>
              <button className="ghostButton" onClick={cerrarSesionAdmin}>
                Salir
              </button>
            </>
          ) : (
            <button
              onClick={() => setCarritoAbierto(true)}
              className={cantidadProductos > 0 ? "cartTop active" : "cartTop"}
            >
              🛒 {cantidadProductos}
            </button>
          )}
        </div>
      </nav>

      {mensajeSistema && <div className="toast">{mensajeSistema}</div>}

      {vista === "cliente" ? (
        <>
          <header className="heroPremium" id="inicio">
            <div className="heroCopy">
              <div className="statusPill">
                <span className={comercio.abierto ? "dot abierto" : "dot cerrado"} />
                {comercio.abierto ? "Abierto para pedidos" : "Cerrado ahora"}
              </div>

              {comercio.logoUrl ? (
                <div className="commerceLogoBox">
                  <img src={comercio.logoUrl} alt={comercio.nombre} />
                </div>
              ) : null}

              <h1>
                Tu pedido, <br />
                <span>listo en minutos.</span>
              </h1>

              <p>
                Elige tus productos favoritos, comparte tu ubicación y envía tu
                pedido directo al comercio por WhatsApp.
              </p>

              <div className="heroActions">
                <a href="#menu" className="primaryAction">
                  Ver menú
                </a>

                <a
                  className="secondaryAction"
                  href={`https://wa.me/${comercio.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Escríbenos
                </a>
              </div>

              <div className="heroTrust">
                <div>
                  <strong>Rápido</strong>
                  <span>Pedido en pocos pasos</span>
                </div>

                <div>
                  <strong>Claro</strong>
                  <span>Datos completos de entrega</span>
                </div>

                <div>
                  <strong>Directo</strong>
                  <span>Pedido al WhatsApp</span>
                </div>
              </div>
            </div>

            <div className="heroVisual">
              <div className="blueShape" />
              <img src={comercio.portada} alt={comercio.nombre} />

              <div className="floatingInfo top">
                <strong>{comercio.tiempoEstimado}</strong>
                <span>Tiempo estimado</span>
              </div>

              <div className="floatingInfo bottom">
                <strong>{comercio.nombre}</strong>
                <span>{comercio.direccion}</span>
              </div>
            </div>
          </header>

          <main className="clientArea">
            <section className="categoryDock">
              {categorias.map((categoria) => (
                <button
                  key={categoria}
                  className={
                    categoriaActiva === categoria
                      ? "categoryItem active"
                      : "categoryItem"
                  }
                  onClick={() => setCategoriaActiva(categoria)}
                >
                  <span>{categoria === "Todos" ? "▦" : "○"}</span>
                  {categoria}
                </button>
              ))}
            </section>

            <section className="menuSection" id="menu">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">Menú del comercio</span>
                  <h2>{comercio.nombre}</h2>
                  <p>{comercio.descripcion}</p>
                </div>

                <div className="counterBox">
                  <strong>{productosFiltrados.length}</strong>
                  <span>items</span>
                </div>
              </div>

              <div className="searchBox">
                <input
                  type="text"
                  placeholder="Buscar producto, combo o bebida..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>

              {productosFiltrados.length === 0 ? (
                <div className="sinResultados">
                  <h3>No encontramos productos</h3>
                  <p>Prueba con otra búsqueda o categoría.</p>
                </div>
              ) : (
                <div className="productGrid">
                  {productosFiltrados.map((producto) => (
                    <article className="productCard" key={producto.id}>
                      <div className="productImage">
                        <img src={producto.imagen} alt={producto.nombre} />
                        {producto.popular && <span>Popular</span>}

                        <button
                          className="quickAdd"
                          onClick={() => agregarAlCarrito(producto)}
                        >
                          +
                        </button>
                      </div>

                      <div className="productInfo">
                        <small>{producto.categoria}</small>
                        <h3>{producto.nombre}</h3>
                        <p>{producto.descripcion}</p>

                        <div className="productFooter">
                          <strong>${producto.precio.toFixed(2)}</strong>
                          <button onClick={() => agregarAlCarrito(producto)}>
                            Agregar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="promoBanner" id="destacados">
              <div className="promoIcon">%</div>

              <div>
                <h2>Vende más por WhatsApp</h2>
                <p>
                  Un menú simple, visual y ordenado ayuda a que tus clientes
                  pidan más rápido y con menos errores.
                </p>
              </div>

              <a href="#menu">Ver productos</a>
            </section>

            {carritoAbierto && (
              <button
                className="backdropMobile"
                onClick={() => setCarritoAbierto(false)}
                aria-label="Cerrar pedido"
              />
            )}

            <aside className={carritoAbierto ? "orderPanel open" : "orderPanel"}>
              <div className="handleMobile" />

              <button
                className="closePanel"
                onClick={() => setCarritoAbierto(false)}
              >
                Cerrar
              </button>

              <section className="cartBox">
                <div className="cartHeader">
                  <div>
                    <h2>Tu pedido</h2>
                    <p>{cantidadProductos} producto(s)</p>
                  </div>

                  {carrito.length > 0 && (
                    <button className="textButton" onClick={limpiarCarrito}>
                      Limpiar
                    </button>
                  )}
                </div>

                {carrito.length === 0 ? (
                  <div className="emptyCart">
                    <span>🛒</span>
                    <p>Aún no has agregado productos.</p>
                  </div>
                ) : (
                  <>
                    <ul className="cartList">
                      {carrito.map((producto) => (
                        <li key={producto.id}>
                          <div>
                            <strong>{producto.nombre}</strong>
                            <small>
                              ${producto.precio.toFixed(2)} x {producto.cantidad}
                            </small>
                          </div>

                          <div className="cartActions">
                            <button onClick={() => quitarDelCarrito(producto.id)}>
                              -
                            </button>

                            <strong>
                              ${(producto.precio * producto.cantidad).toFixed(2)}
                            </strong>

                            <button onClick={() => agregarAlCarrito(producto)}>
                              +
                            </button>

                            <button
                              className="deleteBtn"
                              onClick={() =>
                                eliminarProductoDelCarrito(producto.id)
                              }
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="totalBox">
                      <span>Subtotal</span>
                      <strong>${subtotal.toFixed(2)}</strong>
                    </div>
                  </>
                )}
              </section>

              <section className="formBox">
                <h2>Datos de entrega</h2>

                <label>
                  Nombre del cliente *
                  <input
                    type="text"
                    placeholder="Ej: María Pérez"
                    value={cliente.nombre}
                    onChange={(e) => actualizarCliente("nombre", e.target.value)}
                  />
                </label>

                <label>
                  Teléfono *
                  <input
                    type="tel"
                    placeholder="Ej: 0412-0000000"
                    value={cliente.telefono}
                    onChange={(e) => actualizarCliente("telefono", e.target.value)}
                  />
                </label>

                <label>
                  Dirección de entrega *
                  <textarea
                    placeholder="Ej: Av. Bolívar, edificio X, casa 10..."
                    value={cliente.direccion}
                    onChange={(e) => actualizarCliente("direccion", e.target.value)}
                  />
                </label>

                <button className="locationBtn" onClick={obtenerUbicacionActual}>
                  📍 Usar mi ubicación actual
                </button>

                {cliente.lat && cliente.lng && (
                  <a
                    className="mapLink"
                    href={`https://www.google.com/maps?q=${cliente.lat},${cliente.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver ubicación en Google Maps
                  </a>
                )}

                <label>
                  Método de pago
                  <select
                    value={cliente.metodoPago}
                    onChange={(e) => actualizarCliente("metodoPago", e.target.value)}
                  >
                    <option>Pago móvil</option>
                    <option>Transferencia</option>
                    <option>Efectivo Bs</option>
                    <option>Efectivo USD</option>
                    <option>Binance</option>
                    <option>Zinli</option>
                  </select>
                </label>

                <label>
                  Notas del pedido
                  <textarea
                    placeholder="Ej: Sin cebolla, llamar al llegar..."
                    value={cliente.notas}
                    onChange={(e) => actualizarCliente("notas", e.target.value)}
                  />
                </label>

                <button
                  className={
                    pedidoValido ? "whatsappButton" : "whatsappButton disabled"
                  }
                  onClick={enviarPedidoPorWhatsApp}
                >
                  Enviar pedido por WhatsApp
                </button>

                <p className="formNote">
                  * El comercio confirmará disponibilidad y costo de delivery.
                </p>
              </section>
            </aside>
          </main>

          <button
            className={cantidadProductos > 0 ? "floatingCart active" : "floatingCart"}
            onClick={() => setCarritoAbierto(true)}
          >
            <span>Tu pedido</span>
            <strong>
              {cantidadProductos} productos • ${subtotal.toFixed(2)}
            </strong>
          </button>
        </>
      ) : (
        <main className="adminArea">
          <section className="adminHero">
            <div>
              <div className="adminBrand">
                Pedi<span>2</span>
              </div>

              <p className="adminEyebrow">Panel administrador</p>
              <h1>{comercio.nombre}</h1>
              <p>
                Gestiona productos, datos del comercio, pedidos recibidos y
                personalización visual.
              </p>
            </div>

            <div className="adminActions">
              <a className="primaryAction small" href={`/${slugComercio}`}>
                Ver menú
              </a>
              <button onClick={copiarLinkMenu}>Copiar link</button>
            </div>
          </section>

          <section className="adminStats">
            <div>
              <strong>{productos.length}</strong>
              <span>Productos</span>
            </div>

            <div>
              <strong>{pedidos.length}</strong>
              <span>Pedidos</span>
            </div>

            <div>
              <strong>${pedidos.reduce((acc, pedido) => acc + Number(pedido.subtotal || 0), 0).toFixed(2)}</strong>
              <span>Vendido registrado</span>
            </div>

            <div>
              <strong>{comercio.abierto ? "Abierto" : "Cerrado"}</strong>
              <span>Estado</span>
            </div>
          </section>

          <section className="adminGrid">
            <div className="adminCard">
              <h2>Datos del comercio</h2>

              <label>
                Nombre
                <input
                  value={comercio.nombre}
                  onChange={(e) => actualizarComercio("nombre", e.target.value)}
                />
              </label>

              <label>
                Descripción
                <textarea
                  value={comercio.descripcion}
                  onChange={(e) =>
                    actualizarComercio("descripcion", e.target.value)
                  }
                />
              </label>

              <label>
                WhatsApp de pedidos
                <input
                  value={comercio.whatsapp}
                  onChange={(e) => actualizarComercio("whatsapp", e.target.value)}
                />
              </label>

              <label>
                Dirección
                <input
                  value={comercio.direccion}
                  onChange={(e) => actualizarComercio("direccion", e.target.value)}
                />
              </label>

              <label>
                Tiempo estimado
                <input
                  value={comercio.tiempoEstimado}
                  onChange={(e) =>
                    actualizarComercio("tiempoEstimado", e.target.value)
                  }
                />
              </label>

              <label>
                Pedido mínimo
                <input
                  type="number"
                  value={comercio.minimoPedido}
                  onChange={(e) =>
                    actualizarComercio("minimoPedido", Number(e.target.value))
                  }
                />
              </label>

              <label>
                Imagen de portada URL
                <input
                  value={comercio.portada}
                  onChange={(e) => actualizarComercio("portada", e.target.value)}
                />
              </label>

              <label>
                Logo URL
                <input
                  value={comercio.logoUrl}
                  placeholder="https://..."
                  onChange={(e) => actualizarComercio("logoUrl", e.target.value)}
                />
              </label>

              <label>
                Color principal
                <input
                  type="color"
                  value={comercio.colorPrimario}
                  onChange={(e) =>
                    actualizarComercio("colorPrimario", e.target.value)
                  }
                />
              </label>

              <label>
                PIN administrador
                <input
                  value={comercio.adminPin}
                  onChange={(e) => actualizarComercio("adminPin", e.target.value)}
                />
              </label>

              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={comercio.abierto}
                  onChange={(e) => actualizarComercio("abierto", e.target.checked)}
                />
                Comercio abierto
              </label>
            </div>

            <div className="adminCard">
              <h2>Agregar producto</h2>

              <label>
                Nombre *
                <input
                  value={nuevoProducto.nombre}
                  onChange={(e) =>
                    setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })
                  }
                />
              </label>

              <label>
                Descripción
                <textarea
                  value={nuevoProducto.descripcion}
                  onChange={(e) =>
                    setNuevoProducto({
                      ...nuevoProducto,
                      descripcion: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Precio *
                <input
                  type="number"
                  value={nuevoProducto.precio}
                  onChange={(e) =>
                    setNuevoProducto({ ...nuevoProducto, precio: e.target.value })
                  }
                />
              </label>

              <label>
                Categoría *
                <input
                  placeholder="Ej: Hamburguesas"
                  value={nuevoProducto.categoria}
                  onChange={(e) =>
                    setNuevoProducto({
                      ...nuevoProducto,
                      categoria: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Imagen URL
                <input
                  value={nuevoProducto.imagen}
                  onChange={(e) =>
                    setNuevoProducto({
                      ...nuevoProducto,
                      imagen: e.target.value,
                    })
                  }
                />
              </label>

              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={nuevoProducto.popular}
                  onChange={(e) =>
                    setNuevoProducto({
                      ...nuevoProducto,
                      popular: e.target.checked,
                    })
                  }
                />
                Marcar como popular
              </label>

              <button className="fullButton" onClick={agregarProductoAdmin}>
                Agregar producto
              </button>
            </div>
          </section>

          <section className="adminCard pedidosAdmin" id="pedidos">
            <div className="adminSectionHeader">
              <div>
                <h2>Pedidos recibidos</h2>
                <p>{pedidos.length} pedido(s)</p>
              </div>

              <button onClick={() => cargarPedidos(comercioId)}>
                Actualizar pedidos
              </button>
            </div>

            {pedidos.length === 0 ? (
              <div className="sinResultados">
                <h3>No hay pedidos todavía</h3>
                <p>Cuando un cliente envíe un pedido, aparecerá aquí.</p>
              </div>
            ) : (
              <div className="pedidosList">
                {pedidos.map((pedido) => (
                  <div className="pedidoCard" key={pedido.id}>
                    <div className="pedidoTop">
                      <div>
                        <strong>{pedido.cliente_nombre}</strong>
                        <span>{pedido.cliente_telefono}</span>
                      </div>

                      <select
                        value={pedido.estado}
                        onChange={(e) =>
                          actualizarEstadoPedido(pedido.id, e.target.value)
                        }
                      >
                        <option value="pendiente">pendiente</option>
                        <option value="confirmado">confirmado</option>
                        <option value="preparando">preparando</option>
                        <option value="listo">listo</option>
                        <option value="entregado">entregado</option>
                        <option value="cancelado">cancelado</option>
                      </select>
                    </div>

                    <p>{pedido.direccion_entrega}</p>

                    {pedido.lat && pedido.lng && (
                      <a
                        className="mapLink smallMap"
                        href={`https://www.google.com/maps?q=${pedido.lat},${pedido.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver ubicación
                      </a>
                    )}

                    <ul>
                      {pedido.productos?.map((producto, index) => (
                        <li key={index}>
                          {producto.nombre} x{producto.cantidad} — $
                          {Number(producto.total).toFixed(2)}
                        </li>
                      ))}
                    </ul>

                    <div className="pedidoBottom">
                      <strong>${Number(pedido.subtotal).toFixed(2)}</strong>
                      <span>{new Date(pedido.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="adminCard productsAdmin" id="productos">
            <div className="adminSectionHeader">
              <div>
                <h2>Productos cargados</h2>
                <p>{productos.length} producto(s)</p>
              </div>
            </div>

            <div className="adminProductList">
              {productos.map((producto) => (
                <div className="adminProduct" key={producto.id}>
                  <img src={producto.imagen} alt={producto.nombre} />

                  <div className="adminProductFields">
                    <label>
                      Nombre
                      <input
                        value={producto.nombre}
                        onChange={(e) =>
                          actualizarProducto(producto.id, "nombre", e.target.value)
                        }
                      />
                    </label>

                    <label>
                      Categoría
                      <input
                        value={producto.categoria}
                        onChange={(e) =>
                          actualizarProducto(
                            producto.id,
                            "categoria",
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Precio
                      <input
                        type="number"
                        value={producto.precio}
                        onChange={(e) =>
                          actualizarProducto(producto.id, "precio", e.target.value)
                        }
                      />
                    </label>

                    <label>
                      Imagen
                      <input
                        value={producto.imagen}
                        onChange={(e) =>
                          actualizarProducto(producto.id, "imagen", e.target.value)
                        }
                      />
                    </label>

                    <label className="largeField">
                      Descripción
                      <textarea
                        value={producto.descripcion}
                        onChange={(e) =>
                          actualizarProducto(
                            producto.id,
                            "descripcion",
                            e.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="adminProductActions">
                    <button
                      className={producto.activo ? "activeState" : "inactiveState"}
                      onClick={() => alternarProductoActivo(producto.id)}
                    >
                      {producto.activo ? "Activo" : "Inactivo"}
                    </button>

                    <button
                      className={producto.popular ? "popularState" : "secondaryState"}
                      onClick={() => alternarProductoPopular(producto.id)}
                    >
                      {producto.popular ? "Popular" : "No popular"}
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => eliminarProductoAdmin(producto.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;