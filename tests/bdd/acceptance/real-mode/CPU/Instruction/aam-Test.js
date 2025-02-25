/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define([
    "js/util",
    "js/CPU",
    "tools/TestSystem"
], function (
    util,
    CPU,
    TestSystem
) {
    "use strict";

    describe("CPU 'aam' (ASCII adjust ax after multiply) instruction", function () {
        /*jshint bitwise: false */
        var registers,
            system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();
            registers = system.getCPURegisters();

            testSystem.init().done(function () {
                done();
            });
        });

        afterEach(function () {
            system.stop();
            registers = null;
            system = null;
            testSystem = null;
        });

        util.each({
            "divide of al by 2 with no remainder": {
                divisor: "2",
                registers: {
                    ax: 0xfffe
                },
                expectedRegisters: {
                    ah: 127, // Quotient: +127
                    al: 0    // No remainder
                }
            },
            "divide of al by 2 with remainder": {
                divisor: "2",
                registers: {
                    ax: 0xffff
                },
                expectedRegisters: {
                    ah: 127, // Quotient: +127
                    al: 1    // Remainder
                }
            },
            "divide of al by zero": {
                divisor: "0",
                registers: {
                    ax: 0x1234
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    ax: 0x1234
                },
                // Divide by zero
                expectedExceptionVector: CPU.DIVIDE_ERROR
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        var exceptionVector;

                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
aam ${divisor}

hlt
EOS
*/) {}, {divisor: scenario.divisor, bits: is32BitCodeSegment ? 32 : 16});

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(is32BitCodeSegment);
                            });

                            if (scenario.setup) {
                                scenario.setup(registers);
                            }

                            util.each(scenario.registers, function (value, register) {
                                registers[register].set(value);
                            });

                            util.each(scenario.memory, function (options) {
                                system.write(options);
                            });

                            if (scenario.hasOwnProperty("expectedExceptionVector")) {
                                system.on("exception", function (vector) {
                                    exceptionVector = vector;
                                    system.pause();
                                });
                            }

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        util.each(scenario.expectedRegisters, function (value, name) {
                            it("should leave the correct value in " + name, function () {
                                expect(registers[name].get()).to.equal((value & registers[name].getMask()) >>> 0);
                            });
                        });

                        if (scenario.hasOwnProperty("expectedExceptionVector")) {
                            it("should raise the expected CPU exception", function () {
                                expect(exceptionVector).to.equal(scenario.expectedExceptionVector);
                            });

                            it("should save the address of the divide instruction as the return address", function () {
                                expect(registers.ss.readSegment(registers.sp.get(), 2)).to.equal(0x100);
                                expect(registers.ss.readSegment(registers.sp.get() + 2, 2)).to.equal(0);
                            });
                        }
                    });
                });
            });
        });
    });
});
