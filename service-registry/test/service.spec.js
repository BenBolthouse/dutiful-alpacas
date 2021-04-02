//
// ─── REGISTRY INTEGRATION TESTS ─────────────────────────────────────────────────
//

const expect = require("chai").expect;
const chai = require("chai");
const http = require("chai-http");
const spies = require("chai-spies");
require("colors");

const logger = require("../log").logger;
const service = require("../index");
const ServiceRegistry = require("../lib/ServiceRegistry");

chai.use(http);
chai.use(spies);

logger.warn("Logger output level changed to error for testing".dim);
logger.level = "error";

describe("Service Registry".magenta, () => {
  // scoped to describe block
  let reg, cls, clr, hed;
  let a, b, c, d, e, f, g;
  describe("Service Registry Integration".magenta, () => {
    context("When a new ServiceRegistry is created", () => {
      it("Creates one instance of ServiceRegistry on the service object", () => {
        // arrange
        const cls = service.registry;

        // assert
        expect(cls).to.be.instanceof(ServiceRegistry);
      });
      it("Creates a non-null empty array property called 'clusters'", () => {
        // arrange
        const clr = service.registry.clusters;

        // assert
        expect(clr).to.be.an("array").and.be.empty.and.not.null;
      });
      it("Creates a non-null number property called 'interval'", () => {
        // arrange
        const itv = service.registry.interval;

        // assert
        expect(itv).to.be.a("number").and.not.be.null;
      });
    });
  });

  describe("Service Registry Behaviors".magenta, () => {
    // scoped to describe block
    reg = service.registry;
    context("When a service is added to the registry", () => {
      it("Should store the service at version in its own dedicated cluster", () => {
        // arrange
        reg.registerService("test", "1.0.0", "127.0.0.1", 12345);
        cls = reg.clusters;
        clr = cls[0];
        hed = clr.head;

        // assert
        expect(cls).to.not.be.null;
        expect(cls).to.have.a.lengthOf(1);
        expect(clr.hash).to.equal("test/v1.0.0");
        expect(clr.name).to.equal("test");
        expect(clr.version).to.equal("1.0.0");
        expect(hed).to.not.be.null;
        expect(hed).to.deep.equal(clr.cursor);
      });
      it("Should prevent duplicate entries on the same service cluster", () => {
        // assert
        expect(() =>
          reg.registerService("test", "1.0.0", "127.0.0.1", 12345)
        ).to.throw("Service is already in cluster");
      });
      it("Should allow multiple services in a cluster with varying addresses", () => {
        // arrange
        reg.registerService("test", "1.0.0", "127.0.0.1", 12346);
        reg.registerService("test", "1.0.0", "127.0.0.1", 12347);
        reg.registerService("test", "1.0.0", "127.0.0.1", 12348);
        reg.registerService("test", "1.0.0", "127.0.0.2", 12346);
        reg.registerService("test", "1.0.0", "127.0.0.2", 12347);
        reg.registerService("test", "1.0.0", "127.0.0.2", 12348);
        a = hed;
        b = hed.next;
        c = b.next;
        d = c.next;
        e = d.next;
        f = e.next;
        g = f.next;

        // assert
        expect(cls).to.have.a.lengthOf(1);
        expect(a.hash).to.equal("127.0.0.1:12345/test/v1.0.0");
        expect(b.hash).to.equal("127.0.0.1:12346/test/v1.0.0");
        expect(c.hash).to.equal("127.0.0.1:12347/test/v1.0.0");
        expect(d.hash).to.equal("127.0.0.1:12348/test/v1.0.0");
        expect(e.hash).to.equal("127.0.0.2:12346/test/v1.0.0");
        expect(f.hash).to.equal("127.0.0.2:12347/test/v1.0.0");
        expect(g.hash).to.equal("127.0.0.2:12348/test/v1.0.0");
      });
      it("Should create a new cluster for a new version of a service", () => {
        // arrange
        reg.registerService("test", "2.0.0", "127.0.0.1", 12345);

        // assert
        expect(cls).to.have.a.lengthOf(2);
      });
      it("Should sort service clusters by order of reversed precedence version tag", () => {
        // assert
        expect(cls[0].version).to.equal("2.0.0");
        expect(cls[1].version).to.equal("1.0.0");
      });
    });
    context("When a service is requested from the registry", () => {
      it("Should return a hash using a major version", () => {
        // arrange
        const res = reg.getService("test", "v1");

        // assert
        expect(res).to.equal("127.0.0.1:12345/test/v1.0.0");
      });
      it("Should move the cluster cursor right one position when a service is accessed", () => {
        // assert
        expect(clr.cursor).to.deep.equal(b);
      });
      it("Should move the cluster to the head position when all service options are expended", () => {
        // arrange
        for (let i = 0; i < 6; i++) reg.getService("test", "v1");

        // assert
        expect(clr.cursor).to.deep.equal(a);
      });
      it("Should return a hash using a minor version", () => {
        // arrange
        reg.registerService("test", "1.1.0", "127.0.0.1", 12345);

        // act
        const res = reg.getService("test", "v1.0");

        // assert
        expect(res).to.equal("127.0.0.1:12345/test/v1.0.0");
      });
      it("Should return a hash using a patch version", () => {
        // arrange
        reg.registerService("test", "1.1.1", "127.0.0.1", 12345);

        // act
        const res = reg.getService("test", "v1.0.0");

        // assert
        expect(res).to.equal("127.0.0.1:12346/test/v1.0.0");
      });
      it("Should throw an error if a specific cluster does not exist", () => {
        // assert
        expect(() => reg.getService("test", "3.0.0")).to.throw(
          "Service cluster does not exist"
        );
      });
    });
    context("When a service is removed from the registry", () => {
      it("Should remove a cluster when a sole service is removed from the cluster", () => {
        // arrange
        reg.removeService("test", "2.0.0", "127.0.0.1", 12345);

        // assert
        expect(cls[0].version).to.equal("1.1.1");
      });
      it("Should remove the head of a cluster list", () => {
        // arrange
        cls.splice(0, 2);
        reg.removeService("test", "1.0.0", "127.0.0.1", 12345);

        // assert
        expect(cls[0].head).to.deep.equal(b);
      });
      it("Should remove a service from the middle of a cluster list", () => {
        // arrange
        reg.removeService("test", "1.0.0", "127.0.0.1", 12347);

        // assert
        expect(b.next).to.deep.equal(d);
      });
      it("Should remove a service from the end of a cluster list", () => {
        // arrange
        reg.removeService("test", "1.0.0", "127.0.0.2", 12348);

        // assert
        expect(f.next).to.be.null;
      });
      it("Should set the cluster cursor back to the head position", () => {
        // arrange
        expect(cls[0].cursor).to.deep.equal(b);
      });
      it("Should throw an error if a specific cluster does not exist", () => {
        // assert
        expect(() =>
          reg.removeService("test", "3.0.0", "127.0.0.2", 12348)
        ).to.throw("Service cluster does not exist");
      });
    });
  });
  describe("Service Registry Routing".magenta, () => {
    context("GET", () => {
      it("Should get a service by major version", (done) => {
        // arrange
        chai
          .request(service)
          .get("/registry/test/v1")
          .end((err, res) => {
            // assert
            let hsh = res.body.service;
            expect(hsh).to.equal("127.0.0.1:12346/test/v1.0.0");
            done();
          });
      });
      it("Should get a service by minor version", (done) => {
        // arrange
        reg.registerService("test", "1.1.0", "127.0.0.1", 12345);
        reg.registerService("test", "1.1.1", "127.0.0.1", 12345);

        // act
        chai
          .request(service)
          .get("/registry/test/v1.0")
          .end((err, res) => {
            // assert
            let hsh = res.body.service;
            expect(hsh).to.equal("127.0.0.1:12348/test/v1.0.0");
            done();
          });
      });
      it("Should get a service by patch version", (done) => {
        // act
        chai
          .request(service)
          .get("/registry/test/v1.0.0")
          .end((err, res) => {
            // assert
            let hsh = res.body.service;
            expect(hsh).to.equal("127.0.0.2:12346/test/v1.0.0");
            done();
          });
      });
      it("Should get the next service at the cursor", (done) => {
        // act
        chai
          .request(service)
          .get("/registry/test/v1.0.0")
          .end((err, res) => {
            // assert
            let hsh = res.body.service;
            expect(hsh).to.equal("127.0.0.2:12347/test/v1.0.0");
            done();
          });
      });
    });
    context("PUT", () => {
      it("Should create a new cluster and return a message to the service provider", (done) => {
        // act
        chai
          .request(service)
          .put("/registry/test/v2.1.0/55543")
          .end((err, res) => {
            // assert
            let hsh = res.body.message;
            expect(hsh).to.equal(
              "Service test at version v2.1.0 was successfully added to the registry."
            );
            done();
          });
      });
      it("Should add to an existing cluster and return a message to the service provider", (done) => {
        // act
        chai
          .request(service)
          .put("/registry/test/v1.0.0/55543")
          .end((err, res) => {
            // assert
            let hsh = res.body.message;
            expect(hsh).to.equal(
              "Service test at version v1.0.0 was successfully added to the registry."
            );
            done();
          });
      });
    });
    context("DELETE", () => {
      it("Should remove a service from a cluster and return a message to the service provider", (done) => {
        // act
        chai
          .request(service)
          .delete("/registry/test/v1.0.0/55543")
          .end((err, res) => {
            // assert
            let hsh = res.body.message;
            expect(hsh).to.equal(
              "Service test at version v1.0.0 was successfully removed from the registry."
            );
            done();
          });
      });
    });
  });
});
