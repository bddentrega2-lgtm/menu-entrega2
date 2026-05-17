import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";

const COMERCIO_ID = "7bc9c0b0-de94-4481-bc4b-3d9cb7ad5254";

const comercioInicial = {
  nombre: "Comercio Demo",
  descripcion: "Menú digital para recibir pedidos por WhatsApp.",
  whatsapp: "584245666025",
  direccion: "Av. Principal, Maracay, Aragua",
  tiempoEstimado: "30 - 45 min",
  minimoPedido: 5,
  abierto: true,
  portada:
    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80",
};

function App() {
  const rutaActual = window.location.pathname;
const esAdmin = rutaActual === "/admin";
const [vista] = useState(esAdmin ? "admin" : "cliente");
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [mensajeSistema, setMensajeSistema] = useState("");
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [comercio, setComercio] = useState(comercioInicial);
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

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
    cargarDatosDesdeSupabase();
  }, []);

  async function cargarDatosDesdeSupabase() {
    try {
      setCargandoDatos(true);

      const { data: comercioData, error: comercioError } = await supabase
        .from("comercios")
        .select("*")
        .eq("id", COMERCIO_ID)
        .single();

      if (comercioError) throw comercioError;

      const { data: productosData, error: productosError } = await supabase
        .from("productos")
        .select("*")
        .eq("comercio_id", COMERCIO_ID)
        .order("created_at", { ascending: true });

      if (productosError) throw productosError;

      setComercio({
        nombre: comercioData.nombre,
        descripcion: comercioData.descripcion,
        whatsapp: comercioData.whatsapp,
        direccion: comercioData.direccion,
        tiempoEstimado: comercioData.tiempo_estimado,
        minimoPedido: Number(comercioData.minimo_pedido),
        abierto: comercioData.abierto,
        portada: comercioData.portada,
      });

      setProductos(
        productosData.map((producto) => ({
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
    } catch (error) {
      console.error(error);
      setMensajeSistema("No pudimos cargar datos desde Supabase.");
    } finally {
      setCargandoDatos(false);
    }
  }

  const productosActivos = productos.filter((producto) => producto.activo);

  const categorias = [
    "Todos",
    ...new Set(productosActivos.map((producto) => producto.categoria)),
  ];

  const productosFiltrados = useMemo(() => {
    return productosActivos.filter((producto) => {
      const coincideCategoria =
        categoriaActiva === "Todos" || producto.categoria === categoriaActiva;

      const texto = busqueda.toLowerCase().trim();

      const coincideBusqueda =
        producto.nombre.toLowerCase().includes(texto) ||
        producto.descripcion.toLowerCase().includes(texto) ||
        producto.categoria.toLowerCase().includes(texto);

      return coincideCategoria && coincideBusqueda;
    });
  }, [productosActivos, categoriaActiva, busqueda]);

  const productosPopulares = productosActivos.filter((producto) => producto.popular);

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

  const actualizarCliente = (campo, valor) => {
    setCliente({
      ...cliente,
      [campo]: valor,
    });
  };

  const agregarAlCarrito = (producto) => {
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
  };

  const quitarDelCarrito = (productoId) => {
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
  };

  const eliminarProductoDelCarrito = (productoId) => {
    setCarrito(carrito.filter((item) => item.id !== productoId));
  };

  const limpiarCarrito = () => {
    setCarrito([]);
    setCarritoAbierto(false);
  };

  const obtenerUbicacionActual = () => {
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
          "No pudimos obtener la ubicación. Puedes escribir tu dirección manualmente."
        );
      }
    );
  };

  const actualizarComercio = async (campo, valor) => {
    const comercioActualizado = {
      ...comercio,
      [campo]: valor,
    };

    setComercio(comercioActualizado);

    const campoSupabase =
      campo === "tiempoEstimado"
        ? "tiempo_estimado"
        : campo === "minimoPedido"
        ? "minimo_pedido"
        : campo;

    const { error } = await supabase
      .from("comercios")
      .update({
        [campoSupabase]: valor,
      })
      .eq("id", COMERCIO_ID);

    if (error) {
      console.error(error);
      setMensajeSistema("No se pudo guardar el comercio.");
    } else {
      setMensajeSistema("Comercio actualizado en la nube.");
    }
  };

  const agregarProductoAdmin = async () => {
    if (
      nuevoProducto.nombre.trim() === "" ||
      nuevoProducto.precio === "" ||
      nuevoProducto.categoria.trim() === ""
    ) {
      alert("Completa nombre, precio y categoría.");
      return;
    }

    const productoParaGuardar = {
      comercio_id: COMERCIO_ID,
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

    setMensajeSistema("Producto agregado en la nube.");
    setNuevoProducto({
      nombre: "",
      descripcion: "",
      precio: "",
      categoria: "",
      imagen: "",
      activo: true,
      popular: false,
    });

    cargarDatosDesdeSupabase();
  };

  const actualizarProducto = async (id, campo, valor) => {
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
      setMensajeSistema("Producto actualizado en la nube.");
    }
  };

  const alternarProductoActivo = async (id) => {
    const producto = productos.find((item) => item.id === id);
    if (!producto) return;

    await actualizarProducto(id, "activo", !producto.activo);
  };

  const eliminarProductoAdmin = async (id) => {
    const confirmar = confirm("¿Seguro que quieres eliminar este producto?");

    if (!confirmar) return;

    const { error } = await supabase.from("productos").delete().eq("id", id);

    if (error) {
      console.error(error);
      setMensajeSistema("No se pudo eliminar el producto.");
      return;
    }

    setMensajeSistema("Producto eliminado.");
    cargarDatosDesdeSupabase();
  };

  const copiarLinkMenu = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMensajeSistema("Link del menú copiado.");
    } catch {
      setMensajeSistema("No se pudo copiar. Cópialo desde el navegador.");
    }
  };

  const enviarPedidoPorWhatsApp = () => {
    if (!pedidoValido) {
      alert("Completa nombre, teléfono, dirección y agrega al menos un producto.");
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
  };

  if (cargandoDatos) {
    return (
      <div className="pantallaCarga">
        <div className="brandLoading">Pedi<span>2</span></div>
        <p>Cargando menú digital...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="topBar">
        <div className="brandText">
          Pedi<span>2</span>
        </div>

        <div className="navLinks">
          <a href="#inicio">Inicio</a>
          <a href="#menu">Menú</a>
          <a href="#destacados">Destacados</a>
        </div>

        {esAdmin && (
  <div className="tabs">
    <a className="tab activo" href="/">
      Ver menú
    </a>
  </div>
)}
      </nav>

      {mensajeSistema && <div className="toast">{mensajeSistema}</div>}

      {vista === "cliente" ? (
        <>
          <header className="heroPremium" id="inicio">
            <div className="heroCopy">
              <div className="statusPill">
                <span className={comercio.abierto ? "dot abierto" : "dot cerrado"}></span>
                {comercio.abierto ? "Abierto para pedidos" : "Cerrado ahora"}
              </div>

              <h1>
                Tú pides, <br />
                <span>Pedi2 lo conecta.</span>
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
                  <strong>Seguro</strong>
                  <span>Datos claros para entrega</span>
                </div>

                <div>
                  <strong>Directo</strong>
                  <span>Pedido al WhatsApp</span>
                </div>
              </div>
            </div>

            <div className="heroVisual">
              <div className="blueShape"></div>

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
                  <span>{categoria === "Todos" ? "▦" : "□"}</span>
                  {categoria}
                </button>
              ))}
            </section>

            <section className="menuSection" id="menu">
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">Menú del comercio</span>
                  <h2>Haz tu pedido</h2>
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
                  placeholder="Buscar hamburguesa, bebida, combo..."
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

            {productosPopulares.length > 0 && (
              <section className="promoBanner" id="destacados">
                <div className="promoIcon">%</div>

                <div>
                  <h2>Productos que tus clientes aman</h2>
                  <p>
                    Destaca combos, promociones o productos con mayor salida
                    para aumentar el ticket promedio.
                  </p>
                </div>

                <a href="#menu">Ver productos</a>
              </section>
            )}

            {carritoAbierto && (
              <button
                className="backdropMobile"
                onClick={() => setCarritoAbierto(false)}
                aria-label="Cerrar pedido"
              />
            )}

            <aside className={carritoAbierto ? "orderPanel open" : "orderPanel"}>
              <div className="handleMobile"></div>

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
                              onClick={() => eliminarProductoDelCarrito(producto.id)}
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
                  className={pedidoValido ? "whatsappButton" : "whatsappButton disabled"}
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
              <div className="adminBrand">Pedi<span>2</span></div>
              <p className="adminEyebrow">Panel administrador</p>
              <h1>Configura el menú del comercio</h1>
              <p>Edita datos, productos y WhatsApp para recibir pedidos.</p>
            </div>

            <div className="adminActions">
              <button onClick={copiarLinkMenu}>Copiar link</button>
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
                Imagen de portada
                <input
                  value={comercio.portada}
                  onChange={(e) => actualizarComercio("portada", e.target.value)}
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
                    setNuevoProducto({ ...nuevoProducto, categoria: e.target.value })
                  }
                />
              </label>

              <label>
                Imagen URL
                <input
                  value={nuevoProducto.imagen}
                  onChange={(e) =>
                    setNuevoProducto({ ...nuevoProducto, imagen: e.target.value })
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

          <section className="adminCard productsAdmin">
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