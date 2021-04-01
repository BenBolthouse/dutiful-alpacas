//
// ─── SERVICE REGISTRY ───────────────────────────────────────────────────────────
//

const log = require("simple-node-logger").createSimpleLogger();

/**********************************************************
 * Creates a data structure to track changes in registering,
 * un-registering and getting services.
 */
class ServiceRegistry {
  /********************************************************/
  constructor() {
    this.clusters = [];
    this.timeout = 30;
  }

  /********************************************************
   * Adds a new service to a service registry cluster
   * defined by service name and version.
   *
   * @param {String} name Service name
   * @param {String} version Semver service version string
   * @param {String} ip Service IP address
   * @param {Integer} port Service port
   */
  add = function (name, version, ip, port) {
    const hash = `n:${name}_v:${version}`;
    const service = new Service(name, version, ip, port);
    // discover existing services with the same version
    const existing = this.clusters.find((s) => s.hash === hash);
    // case of existing service cluster
    if (existing) {
      existing.add(service);
    }
    // case of non-existent cluster
    else if (!existing) {
      this.clusters.push(new ServiceCluster(service));
    }
  };

  remove = function (name, version, ip, port) {
    const clusterHash = `n:${name}_v:${version}`;
    const serviceHash = `n:${name}_v:${version}_a:${ip}_p:${port}`;
    // discover existing services with the same version
    const existing = this.clusters.find((s) => s.hash === clusterHash);
    // case of non-existent cluster
    if (!existing) {
      return log.error("Cannot remove Service: ServiceCluster does not exist.");
    }
    // case of existing service cluster
    else if (existing) {
      existing.remove(serviceHash);
      // case of empty service cluster remove cluster
      if (!existing.head) {
        const idx = this.clusters.indexOf(existing);
        this.clusters.splice(idx, 1);
      }
    }
  };

  get = function (name, version) {
    const hash = `n:${name}_v:${version}`;
    // discover existing services with the same version
    const existing = this.clusters.find((s) => s.hash === hash);
    // case of non-existent cluster
    if (!existing) {
      return log.error("Cannot get Service: ServiceCluster does not exist.");
    }
    // case of existing service cluster
    else if (existing) return existing.get();
  };
}

/**********************************************************
 * Creates a singly-linked list that represents a cluster of
 * services of the same type. For instances of clusters with
 * a single node, the single node is given all of the
 * requests. For instances of clusters with more than one
 * node the cluster load balances to the next available node
 * in the list, and then returns to the first node. This is,
 * in effect, a round robin load balancer.
 */
class ServiceCluster {
  /********************************************************
   * @param {Service} service The initial service instance
   */
  constructor(service) {
    this._typeCheckService(service);
    this.hash = `n:${service.data.name}_v:${service.data.version}`;
    this.version = service.data.version;
    this.head = service;
    this.cursor = service;
  }

  /********************************************************
   * Add a service to the end of the cluster linked list.
   *
   * @param {Service} service
   */
  add = function (service) {
    _typeCheckService(service);
    let cur = this.head;
    // case of empty list
    if (!cur) return (this.head = service);
    // case of at least one node
    else {
      while (cur) {
        if (!cur.next) {
          service.prev = cur;
          cur.next = service;
          return log.info(`Added service ${service.data.hash}`);
        }
        cur = cur.next;
      }
    }
  };

  /********************************************************
   * Removes a service from the cluster by hash.
   *
   * @param {String} hash
   */
  remove = function (hash) {
    let prv = this.head.prev;
    let cur = this.head;
    let nxt = this.head.next;
    // case of empty list
    if (!cur) {
      log.error("Cannot remove Service: ServiceCluster contains 0 services.");
    }
    // case of exactly one node
    else if (cur && !nxt) {
      if (cur.data.hash === hash) return (this.head = null);
    }
    // case of at least two nodes
    else if (cur && nxt) {
      while (cur) {
        if (cur.data.hash === hash) {
          if (!prv) this.head = nxt;
          else if (prv) prv.next = nxt;
          return log.info(`Removed service ${hash}`);
        }
        prv = prv.next;
        cur = cur.next;
        nxt = nxt.next;
      }
    }
    // case of missing service
    else log.warning("Cannot remove Service: Service not found.");
  };

  /********************************************************
   * Gets the next service in the sequence of services.
   */
  get = function () {
    const cur = this.cursor;

    // case of last node loop to head
    if (!cur.next) this.cursor = this.head;
    // case of first or mid node move to next
    else this.cursor = cur.next;

    // return the orig position not the new position
    return cur;
  };

  /********************************************************
   * Private method checks if the object provided is a
   * service and will throw TypeError if false.
   *
   * @param {Object} input
   */
  _typeCheckService = function (input) {
    if (!input || typeof input !== Service) {
      throw new TypeError(
        "ServiceCluster was provided an object that is not a Service."
      );
    }
  };
}

/**********************************************************
 * Creates a node for use in a ServiceCluster.
 */
class Service {
  constructor(name, version, ip, port) {
    this.data = {};
    this.data.hash = `n:${name}_v:${version}_a:${ip}_p:${port}`;
    this.data.name = name;
    this.data.version = version;
    this.data.ip = ip;
    this.data.port = port;
    this.prev = null;
    this.next = null;
  }
}

module.exports = ServiceRegistry;
